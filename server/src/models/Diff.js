import mongoose from 'mongoose';

const diffSchema = new mongoose.Schema(
  {
    repo: { type: mongoose.Schema.Types.ObjectId, ref: 'Repository', required: true, index: true },
    fromSnapshot: { type: mongoose.Schema.Types.ObjectId, ref: 'SpecSnapshot', required: true },
    toSnapshot: { type: mongoose.Schema.Types.ObjectId, ref: 'SpecSnapshot', required: true, unique: true },
    fromCommitSha: { type: String, required: true }, // copied here so the list can show them without extra queries
    toCommitSha: { type: String, required: true },
    changes: { type: mongoose.Schema.Types.Mixed, default: [] }, // classified change records
    summary: {
      total: { type: Number, default: 0 },
      breaking: { type: Number, default: 0 },
      safe: { type: Number, default: 0 },
    },
    hasBreaking: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model('Diff', diffSchema);