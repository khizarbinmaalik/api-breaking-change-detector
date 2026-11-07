import express from 'express';
import requireAuth from '../middleware/requireAuth.js';
import { getOctokitForUser } from '../services/github.js';

const router = express.Router();

// Every route in this file needs a logged-in user
router.use(requireAuth);

// GET /api/github/repos: the user's most recently updated repositories
router.get('/repos', async (req, res, next) => {
  try {
    const octokit = await getOctokitForUser(req.user._id);
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 100,
    });

    // GitHub returns 80+ fields per repo. We send the frontend only what it needs.
    const repos = data.map((r) => ({
      githubRepoId: r.id,
      owner: r.owner.login,
      name: r.name,
      fullName: r.full_name,
      defaultBranch: r.default_branch,
      private: r.private,
      description: r.description,
      updatedAt: r.updated_at,
    }));

    res.json(repos);
  } catch (err) {
    // GitHub answers 401 if the user revoked our app or the token expired
    if (err.status === 401) {
      return res.status(401).json({ message: 'GitHub access expired. Please log in again.' });
    }
    next(err);
  }
});

export default router;