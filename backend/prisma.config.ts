import { config } from 'dotenv';
import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

// Explicitly load .env from the backend directory regardless of where
// the Prisma CLI is invoked from.
config({ path: resolve(__dirname, '.env') });

const databaseUrl = process.env.DATABASE_URL;

// DATABASE_URL is required at runtime (migrate/studio) but not for
// `prisma generate` which only reads the schema file.
// We fall back to a dummy URL so Docker builds succeed without secrets.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl ?? 'postgresql://dummy:dummy@localhost:5432/dummy',
  },
});
