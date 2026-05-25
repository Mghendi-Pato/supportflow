import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { JwtPayload } from './strategies/jwt.strategy';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ============================================================
  // REGISTER — creates user + workspace + makes them WORKSPACE_ADMIN
  // ============================================================
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const slugTaken = await this.prisma.tenant.findUnique({
      where: { slug: dto.workspaceSlug.toLowerCase() },
    });
    if (slugTaken) {
      throw new ConflictException(
        'This workspace URL is already taken. Please choose a different slug.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // Transactionally create: user → tenant → tenant_member → ticket_sequence
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          platformRole: 'MEMBER',
          emailVerifiedAt: new Date(), // Skip email verification for MVP
        },
      });

      const tenant = await tx.tenant.create({
        data: {
          name: dto.workspaceName,
          slug: dto.workspaceSlug.toLowerCase(),
          plan: 'FREE',
          ownerId: user.id,
        },
      });

      await tx.tenantMember.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          role: 'WORKSPACE_ADMIN',
          joinedAt: new Date(),
        },
      });

      // Initialize ticket sequence for the new tenant
      await tx.tenantTicketSequence.create({
        data: {
          tenantId: tenant.id,
          prefix: 'SUP',
          currentValue: 0,
        },
      });

      return { user, tenant };
    });

    const tokens = await this.generateTokens({
      sub: result.user.id,
      email: result.user.email,
      platformRole: 'MEMBER',
      tenantId: result.tenant.id,
      role: 'WORKSPACE_ADMIN',
    });

    await this.storeRefreshToken(result.user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: this.sanitizeUser(result.user),
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
        plan: result.tenant.plan,
      },
    };
  }

  // ============================================================
  // LOGIN
  // ============================================================
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
      include: {
        tenantMemberships: {
          where: { isActive: true },
          include: {
            tenant: { select: { id: true, name: true, slug: true, plan: true } },
          },
          take: 1,
        },
        clientRecord: {
          where: { deletedAt: null },
          include: {
            tenant: { select: { id: true, name: true, slug: true, plan: true } },
          },
        },
      },
    });

    if (!user) throw new UnauthorizedException('Invalid email or password');
    if (!user.isActive) throw new UnauthorizedException('Your account has been deactivated');

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) throw new UnauthorizedException('Invalid email or password');

    const { role, tenantId, tenant } = this.resolveUserContext(user);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      platformRole: user.platformRole,
      tenantId,
      role,
    });

    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: this.sanitizeUser(user),
      tenant,
    };
  }

  // ============================================================
  // REFRESH — rotate the access token using a valid refresh token
  // ============================================================
  async refresh(refreshToken: string) {
    let payload: JwtPayload;

    try {
      payload = this.jwt.verify<JwtPayload>(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub, deletedAt: null },
      select: { id: true, refreshTokenHash: true, isActive: true },
    });

    if (!user || !user.isActive || !user.refreshTokenHash) {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    const tokenValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!tokenValid) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    // Rotate: issue a new pair.
    // Strip JWT-registered claims (iat, exp, nbf, jti) so signAsync doesn't
    // receive both a payload.exp AND an expiresIn option simultaneously.
    const { sub, email, platformRole, tenantId, role } = payload;
    const tokens = await this.generateTokens({ sub, email, platformRole, tenantId, role });
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  // ============================================================
  // LOGOUT — revoke the stored refresh token
  // ============================================================
  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
    return { message: 'Logged out successfully' };
  }

  // ============================================================
  // ACCEPT INVITE — onboard agent or client via secure token
  // ============================================================
  async acceptInvite(dto: AcceptInviteDto) {
    const invitation = await this.prisma.tenantInvitation.findUnique({
      where: { token: dto.token },
      include: { tenant: true },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found or already used');
    }
    if (invitation.acceptedAt) {
      throw new BadRequestException('This invitation has already been accepted');
    }
    if (new Date() > invitation.expiresAt) {
      throw new BadRequestException('This invitation has expired. Please request a new one.');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: invitation.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException(
        'An account with this email already exists. Please log in instead.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    let resolvedRole: string = 'MEMBER';

    const newUser = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: invitation.email.toLowerCase(),
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          platformRole: 'MEMBER',
          emailVerifiedAt: new Date(),
        },
      });

      if (invitation.role === 'CLIENT') {
        await tx.client.update({
          where: { id: invitation.clientId! },
          data: { userId: user.id, onboardedAt: new Date() },
        });
        resolvedRole = 'CLIENT';
      } else {
        const memberRole =
          invitation.role === 'WORKSPACE_ADMIN' ? 'WORKSPACE_ADMIN' : 'AGENT';
        await tx.tenantMember.create({
          data: {
            tenantId: invitation.tenantId,
            userId: user.id,
            role: memberRole,
            invitedAt: invitation.createdAt,
            joinedAt: new Date(),
          },
        });
        resolvedRole = memberRole;
      }

      await tx.tenantInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      return user;
    });

    const tokens = await this.generateTokens({
      sub: newUser.id,
      email: newUser.email,
      platformRole: 'MEMBER',
      tenantId: invitation.tenantId,
      role: resolvedRole,
    });

    await this.storeRefreshToken(newUser.id, tokens.refreshToken);

    return {
      ...tokens,
      user: this.sanitizeUser(newUser),
      tenant: {
        id: invitation.tenant.id,
        name: invitation.tenant.name,
        slug: invitation.tenant.slug,
        plan: invitation.tenant.plan,
      },
    };
  }

  // ============================================================
  // GET CURRENT USER — /auth/me
  // ============================================================
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      include: {
        tenantMemberships: {
          where: { isActive: true },
          include: {
            tenant: {
              select: { id: true, name: true, slug: true, plan: true, logoUrl: true },
            },
          },
          take: 1,
        },
        clientRecord: {
          where: { deletedAt: null },
          include: {
            tenant: {
              select: { id: true, name: true, slug: true, plan: true, logoUrl: true },
            },
          },
        },
      },
    });

    if (!user) throw new UnauthorizedException('User not found');

    const { role, tenantId, tenant } = this.resolveUserContext(user);

    return {
      user: this.sanitizeUser(user),
      role,
      tenantId,
      tenant,
    };
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private async generateTokens(payload: JwtPayload) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN') || '15m',
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN') || '7d',
      }),
    ]);
    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: string, refreshToken: string) {
    const hash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: hash },
    });
  }

  /**
   * Resolves effective role + tenantId from the user's DB relations.
   * Priority: SUPER_ADMIN > WORKSPACE_ADMIN > AGENT > CLIENT
   */
  private resolveUserContext(user: any) {
    if (user.platformRole === 'SUPER_ADMIN') {
      return { role: 'SUPER_ADMIN', tenantId: null, tenant: null };
    }
    if (user.tenantMemberships?.length) {
      const m = user.tenantMemberships[0];
      return { role: m.role, tenantId: m.tenant.id, tenant: m.tenant };
    }
    if (user.clientRecord) {
      return {
        role: 'CLIENT',
        tenantId: user.clientRecord.tenant.id,
        tenant: user.clientRecord.tenant,
      };
    }
    return { role: 'MEMBER', tenantId: null, tenant: null };
  }

  private sanitizeUser(user: any) {
    const { passwordHash, refreshTokenHash, ...safe } = user;
    return safe;
  }
}
