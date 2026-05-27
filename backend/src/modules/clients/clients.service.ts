import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../notifications/email/email.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ListClientsDto } from './dto/list-clients.dto';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

const INVITE_EXPIRY_DAYS = 7;

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  // ============================================================
  // CREATE CLIENT
  // ============================================================
  async create(tenantId: string, dto: CreateClientDto) {
    // Enforce uniqueness: one email per tenant
    const existing = await this.prisma.client.findFirst({
      where: {
        tenantId,
        email: dto.email.toLowerCase(),
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException(
        'A client with this email already exists in your workspace',
      );
    }

    return this.prisma.client.create({
      data: {
        tenantId,
        contactName: dto.contactName,
        email: dto.email.toLowerCase(),
        companyName: dto.companyName ?? null,
        phone: dto.phone ?? null,
        notes: dto.notes ?? null,
      },
    });
  }

  // ============================================================
  // LIST CLIENTS — paginated with optional search
  // ============================================================
  async findAll(tenantId: string | null, query: ListClientsDto) {
    const { page = 1, limit = 20, search, isActive } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ClientWhereInput = {
      ...this.tenantFilter(tenantId),
      deletedAt: null,
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { contactName: { contains: search, mode: 'insensitive' } },
          { companyName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [clients, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          tenantId: true,
          userId: true,       // null = no portal account yet
          contactName: true,
          companyName: true,
          email: true,
          phone: true,
          isActive: true,
          invitedAt: true,
          onboardedAt: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { tickets: true } },
          // notes intentionally excluded from list view
        },
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      data: clients,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ============================================================
  // GET SINGLE CLIENT — with ticket stats
  // ============================================================
  async findOne(tenantId: string | null, clientId: string, requestingRole: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, ...this.tenantFilter(tenantId), deletedAt: null },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            lastLoginAt: true,
          },
        },
        _count: { select: { tickets: true } },
        tickets: {
          where: { deletedAt: null },
          select: { id: true, ticketNumber: true, title: true, status: true, priority: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 5, // Latest 5 tickets preview
        },
      },
    });

    if (!client) throw new NotFoundException('Client not found');

    // Clients should not see internal notes about themselves
    if (requestingRole === 'CLIENT') {
      const { notes, ...safeClient } = client as any;
      return safeClient;
    }

    return client;
  }

  // ============================================================
  // UPDATE CLIENT
  // ============================================================
  async update(tenantId: string, clientId: string, dto: UpdateClientDto) {
    await this.assertClientExists(tenantId, clientId);

    // If changing email, check it's not already taken in this tenant
    if (dto.email) {
      const emailTaken = await this.prisma.client.findFirst({
        where: {
          tenantId,
          email: dto.email.toLowerCase(),
          deletedAt: null,
          NOT: { id: clientId },
        },
      });
      if (emailTaken) {
        throw new ConflictException('Another client already uses this email in your workspace');
      }
    }

    return this.prisma.client.update({
      where: { id: clientId },
      data: {
        ...(dto.contactName && { contactName: dto.contactName }),
        ...(dto.email && { email: dto.email.toLowerCase() }),
        ...(dto.companyName !== undefined && { companyName: dto.companyName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  // ============================================================
  // SOFT DELETE CLIENT
  // ============================================================
  async remove(tenantId: string, clientId: string) {
    const client = await this.assertClientExists(tenantId, clientId);

    // Block deletion if client has open tickets
    const openTickets = await this.prisma.ticket.count({
      where: {
        clientId,
        tenantId,
        deletedAt: null,
        status: { notIn: ['CLOSED', 'FIXED'] },
      },
    });

    if (openTickets > 0) {
      throw new BadRequestException(
        `Cannot remove client — they have ${openTickets} open ticket(s). Close or reassign them first.`,
      );
    }

    // Obfuscate email to free up the unique slot so the same email can be
    // re-added in future (same pattern as user soft-delete):
    //   doe@email.com → doe@email.com1  (first deletion)
    //   doe@email.com → doe@email.com2  (second deletion, after re-add)
    const baseEmail = client.email;
    const similar = await this.prisma.client.findMany({
      where: { tenantId, email: { startsWith: baseEmail } },
      select: { email: true },
    });

    let maxIndex = 0;
    for (const c of similar) {
      if (c.email === baseEmail) continue;
      const suffix = c.email.slice(baseEmail.length);
      if (/^\d+$/.test(suffix)) {
        maxIndex = Math.max(maxIndex, parseInt(suffix, 10));
      }
    }

    const obfuscatedEmail = `${baseEmail}${maxIndex + 1}`;

    return this.prisma.client.update({
      where: { id: clientId },
      data: { email: obfuscatedEmail, deletedAt: new Date(), isActive: false },
    });
  }

  // ============================================================
  // INVITE CLIENT — send portal access invite email
  // ============================================================
  async inviteClient(tenantId: string, inviterId: string, clientId: string) {
    const client = await this.assertClientExists(tenantId, clientId);

    // If client already has a user account, they're already onboarded
    if (client.userId) {
      throw new ConflictException('This client already has portal access');
    }

    // Check for existing pending invite
    const pendingInvite = await this.prisma.tenantInvitation.findFirst({
      where: {
        tenantId,
        email: client.email,
        role: 'CLIENT',
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (pendingInvite) {
      throw new ConflictException(
        'A pending invitation already exists for this client. Check invitations list.',
      );
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    const inviter = await this.prisma.user.findUnique({
      where: { id: inviterId },
      select: { firstName: true, lastName: true },
    });

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    // Create invitation record
    const invitation = await this.prisma.tenantInvitation.create({
      data: {
        tenantId,
        email: client.email,
        role: 'CLIENT',
        clientId: client.id,
        invitedById: inviterId,
        token,
        expiresAt,
      },
    });

    // Mark client as invited
    await this.prisma.client.update({
      where: { id: clientId },
      data: { invitedAt: new Date() },
    });

    // Send invite email
    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const inviteUrl = `${frontendUrl}/invite?token=${token}`;

    await this.email.sendInviteEmail({
      to: client.email,
      inviteeName: client.contactName,
      inviterName: `${inviter?.firstName} ${inviter?.lastName}`,
      workspaceName: tenant!.name,
      role: 'CLIENT',
      inviteUrl,
      expiresInDays: INVITE_EXPIRY_DAYS,
    });

    return {
      message: `Portal invitation sent to ${client.email}`,
      invitationId: invitation.id,
      expiresAt,
    };
  }

  // ============================================================
  // RESEND INVITE — re-issue expired or pending invite
  // ============================================================
  async resendInvite(tenantId: string, inviterId: string, clientId: string) {
    const client = await this.assertClientExists(tenantId, clientId);

    if (client.userId) {
      throw new ConflictException('This client already has portal access');
    }

    // Expire any existing pending invite first
    await this.prisma.tenantInvitation.updateMany({
      where: {
        tenantId,
        email: client.email,
        role: 'CLIENT',
        acceptedAt: null,
      },
      data: { expiresAt: new Date() },
    });

    // Issue a fresh invite
    return this.inviteClient(tenantId, inviterId, clientId);
  }

  // ============================================================
  // PRIVATE
  // ============================================================
  private tenantFilter(tenantId: string | null): { tenantId?: string } {
    return tenantId ? { tenantId } : {};
  }

  private async assertClientExists(tenantId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId, deletedAt: null },
    });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }
}
