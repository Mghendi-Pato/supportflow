import { config } from 'dotenv';
import { resolve } from 'node:path';

// Load .env before constructing PrismaClient so DATABASE_URL is in process.env
config({ path: resolve(__dirname, '../.env') });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const BCRYPT_ROUNDS = 12;

async function main() {
  console.log('🌱 Seeding SupportFlow production database...\n');

  // ============================================================
  // 1. SUPER ADMIN
  //    Platform-wide — not tied to any tenant.
  //    Password = email address. CHANGE IMMEDIATELY after first login.
  // ============================================================
  const superAdmin = await prisma.user.upsert({
    where: { email: 'info@nubiannetworks.com' },
    update: {},
    create: {
      email: 'info@nubiannetworks.com',
      passwordHash: await bcrypt.hash('info@nubiannetworks.com', BCRYPT_ROUNDS),
      firstName: 'Mwamburi',
      lastName: 'Patrick',
      platformRole: 'SUPER_ADMIN',
      emailVerifiedAt: new Date(),
    },
  });
  console.log('✅ Super Admin:', superAdmin.email);

  // ============================================================
  // 2. WORKSPACE ADMIN (Tenant Owner)
  //    Owns the NubianNetworks workspace.
  //    Password = email address. CHANGE IMMEDIATELY after first login.
  // ============================================================
  const workspaceAdmin = await prisma.user.upsert({
    where: { email: 'support@nubiannetworks.com' },
    update: {},
    create: {
      email: 'support@nubiannetworks.com',
      passwordHash: await bcrypt.hash(
        'support@nubiannetworks.com',
        BCRYPT_ROUNDS,
      ),
      firstName: 'Mwamburi',
      lastName: 'Patrick',
      platformRole: 'MEMBER',
      emailVerifiedAt: new Date(),
    },
  });
  console.log('✅ Workspace Admin:', workspaceAdmin.email);

  // ============================================================
  // 3. TENANT — NubianNetworks workspace
  // ============================================================
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'nubian-networks' },
    update: {},
    create: {
      name: 'NubianNetworks',
      slug: 'nubian-networks',
      plan: 'PRO',
      ownerId: workspaceAdmin.id,
    },
  });
  console.log('✅ Tenant:', tenant.name, `(${tenant.slug})`);

  // Link workspace admin as WORKSPACE_ADMIN member of the tenant
  await prisma.tenantMember.upsert({
    where: {
      tenantId_userId: { tenantId: tenant.id, userId: workspaceAdmin.id },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: workspaceAdmin.id,
      role: 'WORKSPACE_ADMIN',
      joinedAt: new Date(),
    },
  });
  console.log('✅ Workspace Admin linked to tenant');

  // Initialize ticket number sequence for the tenant (prefix SUP, starts at 0)
  await prisma.tenantTicketSequence.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: { tenantId: tenant.id, prefix: 'SUP', currentValue: 0 },
  });
  console.log('✅ Ticket sequence initialized (SUP-1, SUP-2, ...)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
