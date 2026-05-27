import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

// Fields safe to return — never expose passwordHash or refreshTokenHash
const SAFE_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  platformRole: true,
  isActive: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // GET OWN PROFILE
  // ============================================================
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: {
        ...SAFE_USER_SELECT,
        tenantMemberships: {
          where: { isActive: true },
          select: {
            role: true,
            joinedAt: true,
            tenant: {
              select: { id: true, name: true, slug: true, plan: true, logoUrl: true },
            },
          },
          take: 1,
        },
        clientRecord: {
          select: {
            id: true,
            companyName: true,
            contactName: true,
            tenant: {
              select: { id: true, name: true, slug: true, logoUrl: true },
            },
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ============================================================
  // UPDATE PROFILE — name only (email changes are out of MVP scope)
  // ============================================================
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.lastName && { lastName: dto.lastName }),
      },
      select: SAFE_USER_SELECT,
    });
  }

  // ============================================================
  // CHANGE PASSWORD
  // ============================================================
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: { id: true, passwordHash: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const currentValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!currentValid) throw new UnauthorizedException('Current password is incorrect');

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    const newHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        refreshTokenHash: null, // Revoke all existing sessions on password change
      },
    });

    return { message: 'Password changed successfully. Please log in again.' };
  }

  // ============================================================
  // LIST WORKSPACE MEMBERS (admin use — for assigning tickets, etc.)
  // ============================================================
  async getWorkspaceMembers(tenantId: string) {
    const members = await this.prisma.tenantMember.findMany({
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
          },
        },
      },
      orderBy: { role: 'asc' },
    });

    return members.map((m) => ({
      ...m.user,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  // ============================================================
  // SUPER ADMIN — list all users on the platform
  // ============================================================
  async getAllUsers(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          ...SAFE_USER_SELECT,
          _count: { select: { tenantMemberships: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data: users, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ============================================================
  // SUPER ADMIN — soft delete a user with email obfuscation
  //
  // To prevent future registration conflicts when a user re-registers
  // after deletion, we append an incrementing numeric index to their
  // email before setting deletedAt:
  //   doe@email.com  → doe@email.com1  (first deletion)
  //   doe@email.com  → doe@email.com2  (second deletion, after re-register)
  // ============================================================
  async softDeleteUser(requesterId: string, targetUserId: string) {
    if (requesterId === targetUserId) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, platformRole: true, deletedAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.deletedAt) throw new BadRequestException('User is already deleted');
    if (user.platformRole === 'SUPER_ADMIN') {
      throw new ForbiddenException('Cannot delete a Super Admin');
    }

    // Find the next available index by scanning all existing users
    // (including previously deleted ones) whose emails start with the base email.
    const baseEmail = user.email;
    const similar = await this.prisma.user.findMany({
      where: { email: { startsWith: baseEmail } },
      select: { email: true },
    });

    let maxIndex = 0;
    for (const u of similar) {
      if (u.email === baseEmail) continue; // skip the current record itself
      const suffix = u.email.slice(baseEmail.length);
      if (/^\d+$/.test(suffix)) {
        maxIndex = Math.max(maxIndex, parseInt(suffix, 10));
      }
    }

    const obfuscatedEmail = `${baseEmail}${maxIndex + 1}`;

    return this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        email: obfuscatedEmail,
        isActive: false,
        deletedAt: new Date(),
        refreshTokenHash: null, // revoke all sessions immediately
      },
      select: SAFE_USER_SELECT,
    });
  }

  // ============================================================
  // SUPER ADMIN — list all tenants
  // ============================================================
  async getAllTenants(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where: { deletedAt: null },
        skip,
        take: limit,
        include: {
          owner: { select: { id: true, firstName: true, lastName: true, email: true } },
          _count: { select: { clients: true, tickets: true, members: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tenant.count({ where: { deletedAt: null } }),
    ]);

    return { data: tenants, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ============================================================
  // SUPER ADMIN — suspend / reinstate a tenant
  // ============================================================
  async setTenantActiveStatus(tenantId: string, isActive: boolean) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { isActive },
    });
  }
}
