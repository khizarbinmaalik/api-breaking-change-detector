import { Octokit } from 'octokit';
import User from '../models/User.js';
import { decrypt } from '../utils/crypto.js';

// Builds a GitHub client that acts as the given user.
export async function getOctokitForUser(userId) {
  const user = await User.findById(userId).select('+githubAccessToken');
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  return new Octokit({ auth: decrypt(user.githubAccessToken) });
}