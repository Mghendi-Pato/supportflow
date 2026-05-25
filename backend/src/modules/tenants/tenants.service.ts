import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../notifications/email/email.service';
import { Prisma } from '@prisma/client';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { randomBytes } from 'crypto';

const INVITE_EXPIRY_DAYS = 7;

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  // ============================================================
  // GET WORKSPACE — current tenant's full profile
  // ============================================================
  async getMyTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
        _count: {
          select: { clients: true, tickets: true, members: true },
        },
      },
    });

    if (!tenant) throw new NotFoundException('Workspace not found');
    return tenant;
  }

  // ============================================================
  // UPDATE WORKSPACE — name, logo, settings
  // ============================================================
  async updateTenant(tenantId: string, dto: UpdateTenantDto) {
    await this.assertTenantExists(tenantId);

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
        ...(dto.settings && { settings: dto.settings as Prisma.InputJsonValue }),
      },
    });
  }

  // ============================================================
  // GET MEMBERS — all workspace admins + agents
  // ============================================================
  async getMembers(tenantId: string) {
    return this.prisma.tenantMember.findMany({
      where: { tenantId, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ============================================================
  // INVITE MEMBER — send invite to agent or workspace admin
  // ============================================================
  async inviteMember(tenantId: string, inviterId: string, dto: InviteMemberDto) {
    const tenant = await this.assertTenantExists(tenantId);

    // Check if user already has an account and is a member
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        tenantMemberships: { where: { tenantId, isActive: true } },
      },
    });

    if (existingUser?.tenantMemberships.length) {
      throw new ConflictException('This user is already a member of your workspace');
    }

    // Check for a pending (not yet accepted) invite
    const pendingInvite = await this.prisma.tenantInvitation.findFirst({
      where: {
        tenantId,
        email: dto.email.toLowerCase(),
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (pendingInvite) {
      throw new ConflictException('A pending invitation already exists for this email');
    }

    const inviter = await this.prisma.user.findUnique({
      where: { id: inviterId },
      select: { firstName: true, lastName: true },
    });

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    const invitation = await this.prisma.tenantInvitation.create({
      data: {
        tenantId,
        email: dto.email.toLowerCase(),
        role: dto.role,
        invitedById: inviterId,
        token,
        expiresAt,
      },
    });

    // Send invite email
    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const inviteUrl = `${frontendUrl}/invite?token=${token}`;

    await this.email.sendInviteEmail({
      to: dto.email,
      inviteeName: dto.email,
      inviterName: `${inviter?.firstName} ${inviter?.lastName}`,
      workspaceName: tenant.name,
      role: dto.role,
      inviteUrl,
      expiresInDays: INVITE_EXPIRY_DAYS,
    });

    return {
      message: `Invitation sent to ${dto.email}`,
      invitationId: invitation.id,
      expiresAt,
    };
  }

  // ============================================================
  // REMOVE MEMBER — deactivate a team member from the workspace
  // ============================================================
  async removeMember(tenantId: string, requesterId: string, targetUserId: string) {
    // Cannot remove yourself
    if (requesterId === targetUserId) {
      throw new ForbiddenException('You cannot remove yourself from the workspace');
    }

    const membership = await this.prisma.tenantMember.findUnique({
      where: { tenantId_userId: { tenantId, userId: targetUserId } },
    });

    if (!membership || !membership.isActive) {
      throw new NotFoundException('Member not found in this workspace');
    }

    // Check target is not the owner
    const tenant = await this.assertTenantExists(tenantId);
    if (tenant.ownerId === targetUserId) {
      throw new ForbiddenException('Cannot remove the workspace owner');
    }

    return this.prisma.tenantMember.update({
      where: { tenantId_userId: { tenantId, userId: targetUserId } },
      data: { isActive: false },
    });
  }

  // ============================================================
  // UPDATE MEMBER ROLE — change AGENT ↔ WORKSPACE_ADMIN
  // ============================================================
  async updateMemberRole(
    tenantId: string,
    requesterId: string,
    targetUserId: string,
    role: 'AGENT' | 'WORKSPACE_ADMIN',
  ) {
    if (requesterId === targetUserId) {
      throw new ForbiddenException('You cannot change your own role');
    }

    const tenant = await this.assertTenantExists(tenantId);
    if (tenant.ownerId === targetUserId) {
      throw new ForbiddenException('Cannot change the role of the workspace owner');
    }

    const membership = await this.prisma.tenantMember.findUnique({
      where: { tenantId_userId: { tenantId, userId: targetUserId } },
    });
    if (!membership || !membership.isActive) {
      throw new NotFoundException('Member not found in this workspace');
    }

    return this.prisma.tenantMember.update({
      where: { tenantId_userId: { tenantId, userId: targetUserId } },
      data: { role },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  // ============================================================
  // GET PENDING INVITATIONS
  // ============================================================
  async getPendingInvitations(tenantId: string) {
    return this.prisma.tenantInvitation.findMany({
      where: {
        tenantId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
        role: { in: ['WORKSPACE_ADMIN', 'AGENT'] },
      },
      include: {
        invitedBy: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ============================================================
  // REVOKE INVITATION
  // ============================================================
  async revokeInvitation(tenantId: string, invitationId: string) {
    const invite = await this.prisma.tenantInvitation.findFirst({
      where: { id: invitationId, tenantId, acceptedAt: null },
    });

    if (!invite) {
      throw new NotFoundException('Invitation not found or already accepted');
    }

    // Expire it immediately by setting expiresAt to now
    return this.prisma.tenantInvitation.update({
      where: { id: invitationId },
      data: { expiresAt: new Date() },
    });
  }

  // ============================================================
  // PRIVATE
  // ============================================================
  private async assertTenantExists(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
    });
    if (!tenant) throw new NotFoundException('Workspace not found');
    return tenant;
  }
}
