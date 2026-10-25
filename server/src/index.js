import { port } from './config/env.js';
import connectDB from './config/db.js';
import app from './app.js';

connectDB()
  .then(() => app.listen(port, () => console.log(`Server running on http://localhost:${port}`)))
  .catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });