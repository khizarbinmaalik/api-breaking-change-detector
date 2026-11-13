import SpecSnapshot from '../models/SpecSnapshot.js';
import { getOctokitForUser } from './github.js';

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Saves the repo's spec file as it was at `ref` (a branch, tag or commit SHA).
// Returns { snapshot, created }. `created` is false if that commit was already saved.
export async function createSnapshot(repo, ref) {
  const octokit = await getOctokitForUser(repo.user);
  const target = ref || repo.defaultBranch;

  // 1. Turn the branch/tag/SHA into an exact commit SHA
  let commit;
  try {
    ({ data: commit } = await octokit.rest.repos.getCommit({
      owner: repo.owner,
      repo: repo.name,
      ref: target,
    }));
  } catch (err) {
    if (err.status === 404 || err.status === 422) {
      throw httpError(404, `Branch, tag or commit "${target}" was not found`);
    }
    throw err;
  }

  // 2. Already saved? Then there is nothing to do (GitHub can deliver a webhook twice)
  const existing = await SpecSnapshot.findOne({ repo: repo._id, commitSha: commit.sha });
  if (existing) return { snapshot: existing, created: false };

  // 3. Download the spec file exactly as it was at that commit
  let rawSpec;
  try {
    ({ data: rawSpec } = await octokit.rest.repos.getContent({
      owner: repo.owner,
      repo: repo.name,
      path: repo.specFilePath,
      ref: commit.sha,
      mediaType: { format: 'raw' }, // ask for the file's text directly instead of base64
    }));
  } catch (err) {
    if (err.status === 404) {
      throw httpError(404, `${repo.specFilePath} does not exist at commit ${commit.sha.slice(0, 7)}`);
    }
    throw err;
  }
  if (typeof rawSpec !== 'string') rawSpec = Buffer.from(rawSpec).toString('utf8');

  const snapshot = await SpecSnapshot.create({ repo: repo._id, commitSha: commit.sha, rawSpec });
  return { snapshot, created: true };
}