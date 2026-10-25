import mongoose from 'mongoose';

const repositorySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    githubRepoId: { type: Number, required: true },
    owner: { type: String, required: true },
    name: { type: String, required: true },
    fullName: { type: String, required: true }, // "owner/name"
    defaultBranch: { type: String, default: 'main' },
    specFilePath: { type: String, default: 'openapi.yaml' },
    webhookId: Number,
    // Used to verify that incoming webhooks really come from GitHub. Stored encrypted.
    webhookSecret: { type: String, select: false },
  },
  { timestamps: true }
);

repositorySchema.index({ user: 1, githubRepoId: 1 }, { unique: true });

export default mongoose.model('Repository', repositorySchema);