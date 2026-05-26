// Production Prisma config for Docker container.
// Used by Prisma CLI (migrate deploy) in the production image.
// Local development uses prisma.config.ts instead (TypeScript version).
// This plain JS file requires no TypeScript runtime.
module.exports = {
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
};
