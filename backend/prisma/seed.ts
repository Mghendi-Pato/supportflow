/**
 * SupportFlow — Database Seed
 * Run with: npm run db:seed
 *
 * Creates:
 *   - 1 Super Admin
 *   - 1 Demo Workspace (tenant)
 *   - 1 Workspace Admin
 *   - 1 Agent
 *   - 2 Clients (one with portal access, one invite-pending)
 *   - 3 Sample Tickets with comments and activity logs
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';

// Load .env before constructing PrismaClient so DATABASE_URL is in process.env
config({ path: resolve(__dirname, '../.env') });

import { PrismaClient, TicketStatus, TicketPriority, CommentType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

// Prisma 7 requires a driver adapter — url can no longer be in schema.prisma
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const BCRYPT_ROUNDS = 12;

async function main() {
  console.log('🌱 Seeding SupportFlow database...\n');

  // ============================================================
  // 1. SUPER ADMIN
  // ============================================================
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@supportflow.app' },
    update: {},
    create: {
      email: 'admin@supportflow.app',
      passwordHash: await bcrypt.hash('Admin@1234!', BCRYPT_ROUNDS),
      firstName: 'Super',
      lastName: 'Admin',
      platformRole: 'SUPER_ADMIN',
      emailVerifiedAt: new Date(),
    },
  });
  console.log('✅ Super Admin:', superAdmin.email);

  // ============================================================
  // 2. WORKSPACE OWNER (Workspace Admin)
  // ============================================================
  const workspaceAdmin = await prisma.user.upsert({
    where: { email: 'owner@demoagency.com' },
    update: {},
    create: {
      email: 'owner@demoagency.com',
      passwordHash: await bcrypt.hash('Owner@1234!', BCRYPT_ROUNDS),
      firstName: 'Patrick',
      lastName: 'Mwamburi',
      platformRole: 'MEMBER',
      emailVerifiedAt: new Date(),
    },
  });
  console.log('✅ Workspace Admin:', workspaceAdmin.email);

  // ============================================================
  // 3. TENANT
  // ============================================================
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-agency' },
    update: {},
    create: {
      name: 'Demo Agency',
      slug: 'demo-agency',
      plan: 'PRO',
      ownerId: workspaceAdmin.id,
    },
  });
  console.log('✅ Tenant:', tenant.name, `(${tenant.slug})`);

  // Link owner as WORKSPACE_ADMIN
  await prisma.tenantMember.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: workspaceAdmin.id } },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: workspaceAdmin.id,
      role: 'WORKSPACE_ADMIN',
      joinedAt: new Date(),
    },
  });

  // Initialize ticket sequence
  await prisma.tenantTicketSequence.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: { tenantId: tenant.id, prefix: 'SUP', currentValue: 0 },
  });

  // ============================================================
  // 4. AGENT
  // ============================================================
  const agent = await prisma.user.upsert({
    where: { email: 'agent@demoagency.com' },
    update: {},
    create: {
      email: 'agent@demoagency.com',
      passwordHash: await bcrypt.hash('Agent@1234!', BCRYPT_ROUNDS),
      firstName: 'Sarah',
      lastName: 'Otieno',
      platformRole: 'MEMBER',
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.tenantMember.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: agent.id } },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: agent.id,
      role: 'AGENT',
      joinedAt: new Date(),
    },
  });
  console.log('✅ Agent:', agent.email);

  // ============================================================
  // 5. CLIENTS
  // ============================================================

  // Client A — has portal access
  const clientAUser = await prisma.user.upsert({
    where: { email: 'client@acmepos.com' },
    update: {},
    create: {
      email: 'client@acmepos.com',
      passwordHash: await bcrypt.hash('Client@1234!', BCRYPT_ROUNDS),
      firstName: 'James',
      lastName: 'Kariuki',
      platformRole: 'MEMBER',
      emailVerifiedAt: new Date(),
    },
  });

  const clientA = await prisma.client.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'client@acmepos.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: clientAUser.id,
      contactName: 'James Kariuki',
      companyName: 'Acme POS Solutions',
      email: 'client@acmepos.com',
      phone: '+254712345678',
      notes: 'Enterprise client — 3 branch POS system',
      invitedAt: new Date(),
      onboardedAt: new Date(),
    },
  });
  console.log('✅ Client A (with access):', clientA.email);

  // Client B — no portal access yet
  const clientB = await prisma.client.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'billing@retailplus.co.ke' } },
    update: {},
    create: {
      tenantId: tenant.id,
      contactName: 'Mary Wanjiku',
      companyName: 'RetailPlus Kenya',
      email: 'billing@retailplus.co.ke',
      phone: '+254722000111',
      notes: 'New client — awaiting portal invite',
    },
  });
  console.log('✅ Client B (no access yet):', clientB.email);

  // ============================================================
  // 6. TICKETS
  // ============================================================

  // Helper to get next ticket number
  const nextTicketNumber = async () => {
    const result = await prisma.$queryRaw<{ prefix: string; current_value: number }[]>`
      UPDATE tenant_ticket_sequences
      SET current_value = current_value + 1
      WHERE tenant_id = ${tenant.id}
      RETURNING prefix, current_value
    `;
    return `${result[0].prefix}-${result[0].current_value}`;
  };

  // Ticket 1 — Open, High priority, assigned
  const ticket1 = await prisma.ticket.create({
    data: {
      tenantId: tenant.id,
      ticketNumber: await nextTicketNumber(),
      clientId: clientA.id,
      assignedTo: agent.id,
      title: 'Receipt printer not responding after v2.1.4 update',
      description:
        'After updating the POS software to version 2.1.4 on all three branches, ' +
        'the receipt printers have stopped responding. Tested with Epson TM-T20III. ' +
        'Error: "Printer communication timeout". Urgent — affecting live sales.',
      status: TicketStatus.IN_PROGRESS,
      priority: TicketPriority.HIGH,
      createdByUserId: clientAUser.id,
      createdByType: 'client',
    },
  });

  await prisma.ticketComment.createMany({
    data: [
      {
        tenantId: tenant.id,
        ticketId: ticket1.id,
        authorUserId: clientAUser.id,
        content: 'This is urgent — we are losing sales at Branch 2 and Branch 3. Please prioritize.',
        commentType: CommentType.PUBLIC,
      },
      {
        tenantId: tenant.id,
        ticketId: ticket1.id,
        authorUserId: agent.id,
        content: 'Hi James, we have reproduced the issue in our test environment. Working on a hotfix now.',
        commentType: CommentType.PUBLIC,
      },
      {
        tenantId: tenant.id,
        ticketId: ticket1.id,
        authorUserId: agent.id,
        content: 'INTERNAL: Root cause is the new USB driver in v2.1.4 conflicting with older Epson firmware. Fix is ready — awaiting QA sign-off.',
        commentType: CommentType.INTERNAL,
      },
    ],
  });

  await prisma.ticketActivityLog.createMany({
    data: [
      { ticketId: ticket1.id, tenantId: tenant.id, actorUserId: clientAUser.id, action: 'TICKET_CREATED', metadata: {} },
      { ticketId: ticket1.id, tenantId: tenant.id, actorUserId: workspaceAdmin.id, action: 'ASSIGNED', toValue: 'Sarah Otieno', metadata: {} },
      { ticketId: ticket1.id, tenantId: tenant.id, actorUserId: agent.id, action: 'STATUS_CHANGED', fromValue: 'OPEN', toValue: 'IN_PROGRESS', metadata: {} },
    ],
  });
  console.log('✅ Ticket 1:', ticket1.ticketNumber, '— IN_PROGRESS (High)');

  // Ticket 2 — Open, Critical, unassigned
  const ticket2 = await prisma.ticket.create({
    data: {
      tenantId: tenant.id,
      ticketNumber: await nextTicketNumber(),
      clientId: clientA.id,
      assignedTo: null,
      title: 'End-of-day report showing incorrect totals',
      description:
        'The daily sales summary report is showing totals that do not match the transaction log. ' +
        'Discrepancy of approximately KES 12,000 on 2026-05-22. This is blocking our accounting close.',
      status: TicketStatus.OPEN,
      priority: TicketPriority.CRITICAL,
      createdByUserId: workspaceAdmin.id,
      createdByType: 'agent',
    },
  });

  await prisma.ticketActivityLog.create({
    data: { ticketId: ticket2.id, tenantId: tenant.id, actorUserId: workspaceAdmin.id, action: 'TICKET_CREATED', metadata: {} },
  });
  console.log('✅ Ticket 2:', ticket2.ticketNumber, '— OPEN (Critical)');

  // Ticket 3 — Closed
  const ticket3 = await prisma.ticket.create({
    data: {
      tenantId: tenant.id,
      ticketNumber: await nextTicketNumber(),
      clientId: clientA.id,
      assignedTo: agent.id,
      title: 'Cannot log in to POS manager portal',
      description: 'Getting "Invalid credentials" error on manager portal login. Password reset not working.',
      status: TicketStatus.CLOSED,
      priority: TicketPriority.MEDIUM,
      createdByUserId: clientAUser.id,
      createdByType: 'client',
      closedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    },
  });

  await prisma.ticketComment.create({
    data: {
      tenantId: tenant.id,
      ticketId: ticket3.id,
      authorUserId: agent.id,
      content: 'Fixed — the account was locked due to 5 failed attempts. Account has been unlocked and a password reset sent.',
      commentType: CommentType.PUBLIC,
    },
  });

  await prisma.ticketActivityLog.createMany({
    data: [
      { ticketId: ticket3.id, tenantId: tenant.id, actorUserId: clientAUser.id, action: 'TICKET_CREATED', metadata: {} },
      { ticketId: ticket3.id, tenantId: tenant.id, actorUserId: agent.id, action: 'STATUS_CHANGED', fromValue: 'OPEN', toValue: 'FIXED', metadata: {} },
      { ticketId: ticket3.id, tenantId: tenant.id, actorUserId: workspaceAdmin.id, action: 'TICKET_CLOSED', fromValue: 'FIXED', toValue: 'CLOSED', metadata: {} },
    ],
  });
  console.log('✅ Ticket 3:', ticket3.ticketNumber, '— CLOSED (Medium)');

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 Seed complete! Login credentials:\n');
  console.log('  Super Admin:      admin@supportflow.app     / Admin@1234!');
  console.log('  Workspace Admin:  owner@demoagency.com      / Owner@1234!');
  console.log('  Agent:            agent@demoagency.com      / Agent@1234!');
  console.log('  Client:           client@acmepos.com        / Client@1234!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
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
