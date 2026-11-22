import mongoose from 'mongoose';

const specSnapshotSchema = new mongoose.Schema(
  {
    repo:{ type: mongoose.Schema.Types.ObjectId, ref: 'Repository', required: true, index: true },
    commitSha: { type: String, required: true },
    rawSpec: { type: String, required: true }, 
    parsedEndpoints: { type: mongoose.Schema.Types.Mixed, default: [] }, // normalized form for the diff engine
    parseError: { type: String, default: null }, // why the spec could not be parsed, if it could not
  },
  { timestamps: true }
);

// One snapshot per commit per repo
specSnapshotSchema.index({ repo: 1, commitSha: 1 }, { unique: true });

export default mongoose.model('SpecSnapshot', specSnapshotSchema);