import mongoose from 'mongoose';

const changeSchema = new mongoose.Schema(
  {
    endpoint: { type: String, required: true }, // e.g. "/users/{id}"
    method: { type: String, required: true }, // e.g. "GET"
    location: { type: String, enum: ['endpoint', 'parameter', 'response'], required: true },
    field: String, // the parameter or field name affected, if any
    changeType: {
      type: String,
      enum: ['added', 'removed', 'type_changed', 'required_changed'],
      required: true,
    },
    severity: { type: String, enum: ['breaking', 'safe'], required: true },
    description: { type: String, required: true },
  },
  { _id: false }
);

const diffSchema = new mongoose.Schema(
  {
    repo: { type: mongoose.Schema.Types.ObjectId, ref: 'Repository', required: true, index: true },
    fromSnapshot: { type: mongoose.Schema.Types.ObjectId, ref: 'SpecSnapshot', required: true },
    toSnapshot: { type: mongoose.Schema.Types.ObjectId, ref: 'SpecSnapshot', required: true },
    changes: { type: [changeSchema], default: [] },
    overallSeverity: { type: String, enum: ['breaking', 'safe'], required: true },
  },
  { timestamps: true }
);

export default mongoose.model('Diff', diffSchema);