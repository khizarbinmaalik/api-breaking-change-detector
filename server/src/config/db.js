import mongoose from 'mongoose';
import { mongoUri } from './env.js';

export default async function connectDB() {
  await mongoose.connect(mongoUri);
  console.log('MongoDB connected');
}