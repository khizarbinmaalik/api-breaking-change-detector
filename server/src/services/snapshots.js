import SpecSnapshot from "../models/SpecSnapshot.js";
import { getOctokitForUser } from "./github.js";
import { normalizeSpec } from "./specNormalizer.js";
import { createDiffForSnapshot, createChangelogForDiff } from "./diffs.js";

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
  const existing = await SpecSnapshot.findOne({
    repo: repo._id,
    commitSha: commit.sha,
  });
  if (existing) return { snapshot: existing, created: false };

  // 3. Download the spec file exactly as it was at that commit
  let rawSpec;
  try {
    ({ data: rawSpec } = await octokit.rest.repos.getContent({
      owner: repo.owner,
      repo: repo.name,
      path: repo.specFilePath,
      ref: commit.sha,
      mediaType: { format: "raw" }, // ask for the file's text directly instead of base64
    }));
  } catch (err) {
    if (err.status === 404) {
      throw httpError(
        404,
        `${repo.specFilePath} does not exist at commit ${commit.sha.slice(0, 7)}`,
      );
    }
    throw err;
  }
  if (typeof rawSpec !== "string")
    rawSpec = Buffer.from(rawSpec).toString("utf8");

  // 4. Turn the spec into the normalized endpoint list used by the diff engine.
  //    A broken spec is still saved, with the reason, so the commit is not lost.
  let parsedEndpoints = [];
  let parseError = null;
  try {
    parsedEndpoints = normalizeSpec(rawSpec);
  } catch (err) {
    if (err.status !== 422) throw err; // 422 = "the file's content is unusable"; anything else is a real bug
    parseError = err.message;
  }

  const snapshot = await SpecSnapshot.create({
    repo: repo._id,
    commitSha: commit.sha,
    rawSpec,
    parsedEndpoints,
    parseError,
  });

  // 5. Compare with the previous snapshot. A failure here must not lose the snapshot we just saved.
  let diff = null;
  try {
    diff = await createDiffForSnapshot(snapshot);
    if (diff) {
      createChangelogForDiff(diff).catch((err) =>
        console.error(
          `[changelog] could not create changelog for ${repo.fullName}:`,
          err.message,
        ),
      );
    }
  } catch (err) {
    console.error(
      `[diff] could not create diff for ${repo.fullName}:`,
      err.message,
    );
  }

  return { snapshot, created: true, diff };
}
