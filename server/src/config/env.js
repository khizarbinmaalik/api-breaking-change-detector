import 'dotenv/config';

const required = ['MONGO_URI', 'JWT_SECRET', 'ENCRYPTION_KEY'];

const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  console.error('Copy .env.example to .env and fill them in.');
  process.exit(1);
}

if (Buffer.from(process.env.ENCRYPTION_KEY, 'hex').length !== 32) {
  console.error('ENCRYPTION_KEY must be 32 bytes written as 64 hex characters.');
  process.exit(1);
}

export const port = process.env.PORT || 5000;
export const isProd = process.env.NODE_ENV === 'production';
export const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
export const mongoUri = process.env.MONGO_URI;
export const jwtSecret = process.env.JWT_SECRET;
export const encryptionKey = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');