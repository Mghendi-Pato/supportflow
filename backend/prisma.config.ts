import { config } from 'dotenv';
import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

// Explicitly load .env from the backend directory regardless of where
// the Prisma CLI is invoked from.
config({ path: resolve(__dirname, '.env') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is not set.\n' +
    'Run: cp .env.example .env  — then fill in DATABASE_URL before running migrations.',
  );
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl,
  },
});
