import express from 'express';
import requireAuth from '../middleware/requireAuth.js';
import Repository from '../models/Repository.js';
import { getOctokitForUser } from '../services/github.js';
import mongoose from 'mongoose';

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

    res.status(201).json(saved);
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
    const { id } = req.params;
    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({ message: 'Invalid repository id' });
    }

    // Filtering by user means you can only ever delete your own connections
    const deleted = await Repository.findOneAndDelete({ _id: id, user: req.user._id });
    if (!deleted) {
      return res.status(404).json({ message: 'Repository not found' });
    }

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});


export default router;