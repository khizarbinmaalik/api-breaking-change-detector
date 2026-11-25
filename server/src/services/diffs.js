import SpecSnapshot from '../models/SpecSnapshot.js';
import Diff from '../models/Diff.js';
import { normalizeSpec } from './specNormalizer.js';
import { diffEndpoints } from './specDiff.js';
import { classifyChanges, summarize } from './classifier.js';

// Snapshots saved before step 28 have no parsed endpoints, so parse them on the fly
function endpointsOf(snapshot) {
  if (snapshot.parsedEndpoints?.length) return snapshot.parsedEndpoints;
  return normalizeSpec(snapshot.rawSpec);
}

// Compares a new snapshot with the previous good one and saves the result.
// Returns the Diff, or null if there was nothing to compare.
export async function createDiffForSnapshot(snapshot) {
  if (snapshot.parseError) return null;

  const existing = await Diff.findOne({ toSnapshot: snapshot._id });
  if (existing) return existing;

  const previous = await SpecSnapshot.findOne({
    repo: snapshot.repo,
    parseError: null,
    _id: { $lt: snapshot._id }, // created before this one
  }).sort({ _id: -1 });
  if (!previous) return null;

  let before;
  let after;
  try {
    before = endpointsOf(previous);
    after = endpointsOf(snapshot);
  } catch (err) {
    if (err.status === 422) return null; // an old snapshot turned out to be unusable
    throw err;
  }

  const changes = classifyChanges(diffEndpoints(before, after));
  const summary = summarize(changes);

  try {
    return await Diff.create({
      repo: snapshot.repo,
      fromSnapshot: previous._id,
      toSnapshot: snapshot._id,
      fromCommitSha: previous.commitSha,
      toCommitSha: snapshot.commitSha,
      changes,
      summary,
      hasBreaking: summary.breaking > 0,
    });
  } catch (err) {
    if (err.code === 11000) return Diff.findOne({ toSnapshot: snapshot._id }); // someone else just saved it
    throw err;
  }
}