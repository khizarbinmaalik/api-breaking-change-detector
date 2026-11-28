import express from 'express';
import requireAuth from '../middleware/requireAuth.js';
import Repository from '../models/Repository.js';
import Diff from '../models/Diff.js';
import Changelog from '../models/Changelog.js';
import { getOctokitForUser, createRepoWebhook, deleteRepoWebhook} from '../services/github.js';
import mongoose from 'mongoose';
import SpecSnapshot from '../models/SpecSnapshot.js';
import { createSnapshot } from '../services/snapshots.js';
import { encrypt } from '../utils/crypto.js';
import { createChangelogForDiff } from '../services/diffs.js';

const router = express.Router();

// Every route in this file needs a logged-in user
router.use(requireAuth);

const SPEC_PATTERN = /\.(ya?ml|json)$/i;

// POST /api/repos   body: { owner, name, specFilePath? }
router.post('/', async (req, res, next) => {
  try {
    const { owner, name } = req.body;
    const specFilePath = (req.body.specFilePath || 'openapi.yaml').trim().replace(/^\/+/, '');

    if (!owner || !name) {
      return res.status(400).json({ message: 'owner and name are required' });
    }
    if (!SPEC_PATTERN.test(specFilePath)) {
      return res.status(400).json({ message: 'Spec file must be a .yaml, .yml or .json file' });
    }

    const octokit = await getOctokitForUser(req.user._id);

    // 1. Ask GitHub about the repo. This proves the user can access it, and we use
    //    GitHub's answer for the details instead of trusting what the browser sent.
    let repo;
    try {
      ({ data: repo } = await octokit.rest.repos.get({ owner, repo: name }));
    } catch (err) {
      if (err.status === 404) {
        return res.status(404).json({ message: 'Repository not found, or you do not have access to it' });
      }
      throw err;
    }

    // 2. Check that the spec file exists on the default branch
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo: name,
        path: specFilePath,
        ref: repo.default_branch,
      });
      if (Array.isArray(data) || data.type !== 'file') {
        return res.status(400).json({ message: `${specFilePath} is a folder, not a file` });
      }
    } catch (err) {
      if (err.status === 404) {
        return res .status(400)
          .json({ message: `Could not find ${specFilePath} on the ${repo.default_branch} branch` });
      }
      throw err;
    }

    // 3. Save the connection
    const saved = await Repository.create({
      user: req.user._id,
      githubRepoId: repo.id,
      owner: repo.owner.login,
      name: repo.name,
      fullName: repo.full_name,
      defaultBranch: repo.default_branch,
      specFilePath,
    });

    // 4. Register the webhook on GitHub. If this fails, undo the save.
    try {
      const { webhookId, secret } = await createRepoWebhook(octokit, saved.owner, saved.name);
      saved.webhookId = webhookId;
      saved.webhookSecret = encrypt(secret);
      await saved.save();
    } catch (err) {
      await Repository.findByIdAndDelete(saved._id);
      if (err.status === 404 || err.status === 403) {
        return res.status(403).json({
          message: 'Could not create a webhook. You need admin access to this repository.',
        });
      }
      if (err.status === 422) {
        return res.status(409).json({
          message:
            'A webhook for this server already exists on the repository. Delete it in GitHub (Settings > Webhooks) and try again.',
        });
      }
      throw err;
    }

    // 5. Never send the stored secret back to the browser
    const result = saved.toObject();
    delete result.webhookSecret;
    res.status(201).json(result);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'This repository is already connected' });
    }
    if (err.status === 401) {
      return res.status(401).json({ message: 'GitHub access expired. Please log in again.' });
    }
    next(err);
  }
});

// GET /api/repos: the repositories this user has connected
router.get('/', async (req, res, next) => {
  try {
    const repos = await Repository.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(repos);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/repos/:id: disconnect a repository
router.delete('/:id', async (req, res, next) => {
  try {
    const repo = await Repository.findOne({ _id: req.params.id, user: req.user._id });
    if (!repo) return res.status(404).json({ message: 'Repository not found' });

    // 1. Remove the GitHub webhook (best effort: never block the disconnect)
    let webhookRemoved = true;
    if (repo.webhookId) {
      try {
        const octokit = await getOctokitForUser(req.user._id);
        await deleteRepoWebhook(octokit, repo.owner, repo.name, repo.webhookId);
      } catch (err) {
        webhookRemoved = false;
        console.error(`[disconnect] could not remove webhook for ${repo.fullName}:`, err.message);
      }
    }

    // 2. Delete everything that belongs to this repo
    await Promise.all([
      SpecSnapshot.deleteMany({ repo: repo._id }),
      Diff.deleteMany({ repo: repo._id }),
      Changelog.deleteMany({ repo: repo._id }),
    ]);

    // 3. Delete the repo record last, so a failure above can be retried
    await repo.deleteOne();

    res.json({ message: 'Repository disconnected', webhookRemoved });
  } catch (err) {
    next(err);
  }
});

// Loads a repo by the :id in the URL, but only if it belongs to the logged-in user.
// If something is wrong it sends the error response itself and returns null.
async function findOwnedRepo(req, res) {
  const { id } = req.params;
  if (!mongoose.isObjectIdOrHexString(id)) {
    res.status(400).json({ message: 'Invalid repository id' });
    return null;
  }
  const repo = await Repository.findOne({ _id: id, user: req.user._id });
  if (!repo) res.status(404).json({ message: 'Repository not found' });
  return repo;
}

// POST /api/repos/:id/snapshots   body: { ref? }  (a branch, tag or commit SHA; default: the default branch)
router.post('/:id/snapshots', async (req, res, next) => {
  try {
    const repo = await findOwnedRepo(req, res);
    if (!repo) return;

    const ref = typeof req.body?.ref === 'string' ? req.body.ref.trim() : undefined;
    const { snapshot, created } = await createSnapshot(repo, ref || undefined);

    // Don't send the whole spec text back, just a summary
    const { rawSpec, ...summary } = snapshot.toObject();
    res.status(created ? 201 : 200).json({ ...summary, specLength: rawSpec.length, created });
  } catch (err) {
    if (err.status === 401) {
      return res.status(401).json({ message: 'GitHub access expired. Please log in again.' });
    }
    next(err);
  }
});

// GET /api/repos/:id/snapshots: saved versions of the spec, newest first
router.get('/:id/snapshots', async (req, res, next) => {
  try {
    const repo = await findOwnedRepo(req, res);
    if (!repo) return;

    const snapshots = await SpecSnapshot.find({ repo: repo._id })
      .select('-rawSpec -parsedEndpoints')
      .sort({ createdAt: -1 });
    res.json(snapshots);
  } catch (err) {
    next(err);
  }
});

// List of diffs for a repo (newest first), without the full change lists
router.get('/:id/diffs', async (req, res, next) => {
  try {
    const repo = await Repository.findOne({ _id: req.params.id, user: req.user._id });
    if (!repo) return res.status(404).json({ message: 'Repository not found' });

    const diffs = await Diff.find({ repo: repo._id })
      .select('-changes')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(diffs);
  } catch (err) {
    next(err);
  }
});

// Finds a diff, but only if its repo belongs to the logged-in user
async function findOwnedDiff(req) {
  const repo = await Repository.findOne({ _id: req.params.id, user: req.user._id });
  if (!repo) return null;
  return Diff.findOne({ _id: req.params.diffId, repo: repo._id }).lean();
}

const changelogView = (c) => ({ text: c.text, source: c.source, note: c.note, createdAt: c.createdAt });

// One diff in full, together with its changelog
router.get('/:id/diffs/:diffId', async (req, res, next) => {
  try {
    const diff = await findOwnedDiff(req);
    if (!diff) return res.status(404).json({ message: 'Diff not found' });

    // Returns the saved changelog, or creates it now if this diff does not have one yet
    const changelog = await createChangelogForDiff(diff);
    res.json({ ...diff, changelog: changelogView(changelog) });
  } catch (err) {
    next(err);
  }
});

// Try again to get an AI-written changelog (only when the current one is the plain template)
router.post('/:id/diffs/:diffId/changelog/regenerate', async (req, res, next) => {
  try {
    const diff = await findOwnedDiff(req);
    if (!diff) return res.status(404).json({ message: 'Diff not found' });

    const current = await Changelog.findOne({ diff: diff._id });
    if (current && current.source === 'gemini') {
      return res.status(409).json({ message: 'This changelog was already written by the AI' });
    }
    if (current) await current.deleteOne();

    const changelog = await createChangelogForDiff(diff);
    res.json(changelogView(changelog));
  } catch (err) {
    next(err);
  }
});

export default router;