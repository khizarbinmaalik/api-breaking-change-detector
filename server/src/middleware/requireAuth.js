import jwt from 'jsonwebtoken';
import { jwtSecret } from '../config/env.js';
import User from '../models/User.js';

// Protects a route: reads the login cookie, verifies it, and attaches the user to req.user
export default async function requireAuth(req, res, next) {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Not authenticated' });

    const payload = jwt.verify(token, jwtSecret);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ message: 'User no longer exists' });

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired session' });
  }
}