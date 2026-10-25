import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    githubId: { type: Number, required: true, unique: true },
    username: { type: String, required: true },
    displayName: String,
    email: String,
    avatarUrl: String,
    // Stored encrypted. Hidden from queries unless you explicitly ask for it.
    githubAccessToken: { type: String, required: true, select: false },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);