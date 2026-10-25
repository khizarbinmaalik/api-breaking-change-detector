import mongoose from 'mongoose';
import connectDB from './config/db.js';
import User from './models/User.js';
import Repository from './models/Repository.js';
import SpecSnapshot from './models/SpecSnapshot.js';
import Diff from './models/Diff.js';
import Changelog from './models/Changelog.js';

await connectDB();
// make sure the unique indexes exist before we test them
await Promise.all([User, Repository, SpecSnapshot, Diff, Changelog].map((m) => m.init()));

const user = await User.create({ githubId: 999999999, username: 'test-user', githubAccessToken: 'fake-token' });
const repo = await Repository.create({
  user: user._id, githubRepoId: 1, owner: 'test-user', name: 'demo', fullName: 'test-user/demo',
});
const from = await SpecSnapshot.create({ repo: repo._id, commitSha: 'aaa111', rawSpec: 'openapi: 3.0.0' });
const to = await SpecSnapshot.create({ repo: repo._id, commitSha: 'bbb222', rawSpec: 'openapi: 3.0.0' });
const diff = await Diff.create({
  repo: repo._id,
  fromSnapshot: from._id,
  toSnapshot: to._id,
  overallSeverity: 'breaking',
  changes: [
    {
      endpoint: '/users/{id}', method: 'GET', location: 'response', field: 'email',
      changeType: 'removed', severity: 'breaking', description: "Field 'email' removed from response",
    },
  ],
});
await Changelog.create({ diff: diff._id, generatedText: 'Test changelog' });

const found = await Diff.findById(diff._id).populate('fromSnapshot toSnapshot');
console.log('Diff saved:', found.overallSeverity, '|', found.fromSnapshot.commitSha, '->', found.toSnapshot.commitSha);

const hiddenToken = (await User.findById(user._id)).githubAccessToken;
console.log('Token hidden by default:', hiddenToken === undefined);

try {
  await SpecSnapshot.create({ repo: repo._id, commitSha: 'aaa111', rawSpec: 'x' });
  console.log('Duplicate snapshot allowed (unexpected)');
} catch (err) {
  console.log('Duplicate snapshot blocked:', err.code === 11000);
}

// clean up only the test data
await Changelog.deleteMany({ diff: diff._id });
await Diff.deleteMany({ repo: repo._id });
await SpecSnapshot.deleteMany({ repo: repo._id });
await Repository.deleteOne({ _id: repo._id });
await User.deleteOne({ _id: user._id });
await mongoose.disconnect();
console.log('Cleaned up');