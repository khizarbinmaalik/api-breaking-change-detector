import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { github } from './env.js';
import User from '../models/User.js';
import { encrypt } from '../utils/crypto.js';

passport.use(
  new GitHubStrategy(
    {
      clientID: github.clientId,
      clientSecret: github.clientSecret,
      callbackURL: github.callbackUrl,
      scope: github.scope,
    },
    // Runs after GitHub confirms who the user is. We create the user on first login,
    // and refresh their profile and access token on every later login.
    async (accessToken, refreshToken, profile, done) => {
      try {
        const user = await User.findOneAndUpdate(
          { githubId: Number(profile.id) },
          {
            githubId: Number(profile.id),
            username: profile.username,
            displayName: profile.displayName || profile.username,
            email: profile.emails?.[0]?.value,
            avatarUrl: profile.photos?.[0]?.value,
            githubAccessToken: encrypt(accessToken),
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        done(null, user);
      } catch (err) {
        done(err);
      }
    }
  )
);

export default passport;