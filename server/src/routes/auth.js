import crypto from 'crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import passport from '../config/passport.js';
import requireAuth from '../middleware/requireAuth.js';
import { clientUrl, jwtSecret, isProd } from '../config/env.js';

const router = express.Router();

const COOKIE_BASE = { httpOnly: true, sameSite: 'lax', secure: isProd };
const SESSION_DAYS = 7;

// Step 1: send the user to GitHub. We attach a random "state" value and remember it in a
// short-lived cookie, so in step 2 we can prove the login was started by us.
router.get('/github', (req, res, next) => {
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('oauth_state', state, { ...COOKIE_BASE, maxAge: 10 * 60 * 1000 });
  passport.authenticate('github', { session: false, state })(req, res, next);
});

// Step 2: GitHub sends the user back here with ?code=...&state=...
router.get( '/github/callback',
  (req, res, next) => {
    const expected = req.cookies.oauth_state;
    res.clearCookie('oauth_state', COOKIE_BASE);
    if (!expected || expected !== req.query.state) {
      return res.redirect(`${clientUrl}/login?error=state`);
    }
    next();
  },
  passport.authenticate('github', { session: false, failureRedirect: `${clientUrl}/login?error=oauth` }),
  (req, res) => {
    const token = jwt.sign({ sub: req.user.id }, jwtSecret, { expiresIn: `${SESSION_DAYS}d` });
    res.cookie('token', token, { ...COOKIE_BASE, maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000 });
    res.redirect(`${clientUrl}/dashboard`);
  }
);

// Who am I? The React app calls this on load to find out whether someone is logged in.
router.get('/me', requireAuth, (req, res) => {
  const { id, username, displayName, email, avatarUrl } = req.user;
  res.json({ id, username, displayName, email, avatarUrl });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', COOKIE_BASE);
  res.json({ message: 'Logged out' });
});

export default router;