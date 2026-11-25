import mongoose from 'mongoose';

const changelogSchema = new mongoose.Schema(
  {
    repo: { type: mongoose.Schema.Types.ObjectId, ref: 'Repository', required: true, index: true },
    diff: { type: mongoose.Schema.Types.ObjectId, ref: 'Diff', required: true, unique: true }, // one changelog per diff
    text: { type: String, required: true }, // Markdown
    source: { type: String, enum: ['gemini', 'template'], required: true },
    note: { type: String, default: null }, // why the template was used, if it was
  },
  { timestamps: true }
);

export default mongoose.model('Changelog', changelogSchema);