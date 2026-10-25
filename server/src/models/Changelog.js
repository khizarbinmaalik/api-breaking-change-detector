import mongoose from 'mongoose';

const changelogSchema = new mongoose.Schema(
  {
    diff: { type: mongoose.Schema.Types.ObjectId, ref: 'Diff', required: true, unique: true },
    generatedText: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model('Changelog', changelogSchema);