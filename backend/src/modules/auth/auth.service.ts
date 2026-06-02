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
import * as crypto from 'crypto';
import { RegisterDto } from './dto/register.dto';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';
import { PreRegisterDto } from './dto/pre-register.dto';
import { LoginDto } from './dto/login.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { EmailService } from '../notifications/email/email.service';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
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

      const slug = dto.workspaceSlug.toLowerCase();
      const inboundDomain = this.config.get<string>('INBOUND_EMAIL_DOMAIN') || 'inbound.supportflow.app';
      const tenant = await tx.tenant.create({
        data: {
          name: dto.workspaceName,
          slug,
          plan: 'FREE',
          ownerId: user.id,
          inboundEmail: `${slug}@${inboundDomain}`,
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
  // GOOGLE OAUTH — find or create user from Google profile
  // ============================================================
  async handleGoogleLogin(googleUser: {
    googleId:  string;
    email:     string;
    firstName: string;
    lastName:  string;
    avatarUrl: string | null;
  }) {
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { googleId: googleUser.googleId },
          { email: googleUser.email.toLowerCase() },
        ],
        deletedAt: null,
      },
      include: {
        tenantMemberships: {
          where: { isActive: true },
          include: { tenant: { select: { id: true, name: true, slug: true, plan: true } } },
          take: 1,
        },
        clientRecord: {
          where: { deletedAt: null },
          include: { tenant: { select: { id: true, name: true, slug: true, plan: true } } },
        },
      },
    });

    const isNewUser = !user;

    if (user) {
      // Link Google ID if not already linked
      if (!user.googleId) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId:  googleUser.googleId,
            avatarUrl: googleUser.avatarUrl ?? user.avatarUrl,
          },
        });
      }
    } else {
      // New user — create account without a workspace
      // They will be redirected to create one after login
      const inboundDomain = this.config.get<string>('INBOUND_EMAIL_DOMAIN') || 'inbound.supportflow.app';
      user = await this.prisma.user.create({
        data: {
          email:           googleUser.email.toLowerCase(),
          passwordHash:    await bcrypt.hash(crypto.randomUUID(), BCRYPT_ROUNDS), // unusable password
          firstName:       googleUser.firstName,
          lastName:        googleUser.lastName,
          avatarUrl:       googleUser.avatarUrl,
          googleId:        googleUser.googleId,
          platformRole:    'MEMBER',
          emailVerifiedAt: new Date(),
        },
        include: {
          tenantMemberships: {
            where: { isActive: true },
            include: { tenant: { select: { id: true, name: true, slug: true, plan: true } } },
            take: 1,
          },
          clientRecord: {
            where: { deletedAt: null },
            include: { tenant: { select: { id: true, name: true, slug: true, plan: true } } },
          },
        },
      });
    }

    if (!user.isActive) {
      throw new Error('Account deactivated');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const { role, tenantId, tenant } = this.resolveUserContext(user);

    const tokens = await this.generateTokens({
      sub:          user.id,
      email:        user.email,
      platformRole: user.platformRole,
      tenantId,
      role,
    });

    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return { ...tokens, user: this.sanitizeUser(user), tenant, isNewUser };
  }

  // ============================================================
  // PRE-REGISTER — step 1: send verification email
  // ============================================================
  async preRegister(dto: PreRegisterDto) {
    const email = dto.email.toLowerCase();

    // Check if email is already registered
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Silent — don't reveal whether an account exists (anti-enumeration)
      return { message: 'If this email is not already registered, a verification link has been sent.' };
    }

    // Upsert a pending registration record (24 h expiry)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const metadata = dto.plan ? { plan: dto.plan } : {};

    await this.prisma.pendingRegistration.upsert({
      where: { email },
      create: { email, token, expiresAt, metadata },
      update: { token, expiresAt, metadata },
    });

    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3001';
    const verifyUrl = `${frontendUrl}/register/complete?token=${token}`;

    await this.email.sendRegistrationVerificationEmail({ to: email, verifyUrl });

    return { message: 'If this email is not already registered, a verification link has been sent.' };
  }

  // ============================================================
  // VERIFY REGISTRATION TOKEN — validate token (GET, no side-effects)
  // ============================================================
  async verifyRegistrationToken(token: string) {
    const pending = await this.prisma.pendingRegistration.findUnique({ where: { token } });
    if (!pending) throw new BadRequestException('Verification link is invalid or has already been used.');
    if (new Date() > pending.expiresAt) {
      await this.prisma.pendingRegistration.delete({ where: { token } });
      throw new BadRequestException('Verification link has expired. Please start the registration process again.');
    }
    const meta = pending.metadata as Record<string, any>;
    return { valid: true, email: pending.email, plan: meta?.plan ?? 'FREE' };
  }

  // ============================================================
  // COMPLETE REGISTRATION — step 2: create account from token
  // ============================================================
  async completeRegistration(dto: CompleteRegistrationDto) {
    // Validate token
    const pending = await this.prisma.pendingRegistration.findUnique({ where: { token: dto.token } });
    if (!pending) throw new BadRequestException('Verification link is invalid or has already been used.');
    if (new Date() > pending.expiresAt) {
      await this.prisma.pendingRegistration.delete({ where: { token: dto.token } });
      throw new BadRequestException('Verification link has expired. Please start the registration process again.');
    }

    // Guard against duplicate accounts
    const existingUser = await this.prisma.user.findUnique({ where: { email: pending.email } });
    if (existingUser) throw new ConflictException('An account with this email already exists.');

    const slugTaken = await this.prisma.tenant.findUnique({ where: { slug: dto.workspaceSlug.toLowerCase() } });
    if (slugTaken) throw new ConflictException('This workspace URL is already taken. Please choose a different slug.');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const slug = dto.workspaceSlug.toLowerCase();
    const inboundDomain = this.config.get<string>('INBOUND_EMAIL_DOMAIN') || 'inbound.supportflow.app';

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: pending.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          platformRole: 'MEMBER',
          emailVerifiedAt: new Date(),
        },
      });

      const tenant = await tx.tenant.create({
        data: {
          name: dto.workspaceName,
          slug,
          plan: 'FREE', // Always start FREE — upgrade via payment
          ownerId: user.id,
          inboundEmail: `${slug}@${inboundDomain}`,
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

      await tx.tenantTicketSequence.create({
        data: { tenantId: tenant.id, prefix: 'SUP', currentValue: 0 },
      });

      // Consume the pending registration token
      await tx.pendingRegistration.delete({ where: { id: pending.id } });

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

    const requiresPayment = dto.plan !== 'FREE';

    return {
      ...tokens,
      user: this.sanitizeUser(result.user),
      tenant: { id: result.tenant.id, name: result.tenant.name, slug: result.tenant.slug, plan: result.tenant.plan },
      requiresPayment,
      selectedPlan: dto.plan,
    };
  }

  // ============================================================
  // FORGOT PASSWORD — generate token + send email
  // ============================================================
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
    });

    // Always return the same response — don't leak whether email exists
    const genericResponse = {
      message: 'If an account with that email exists, a reset link has been sent.',
    };

    if (!user || !user.isActive) return genericResponse;

    // Generate a secure random token (URL-safe hex string)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpiresAt: expiresAt,
      },
    });

    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    await this.email.sendPasswordResetEmail({
      to: user.email,
      firstName: user.firstName,
      resetUrl,
    });

    return genericResponse;
  }

  // ============================================================
  // RESET PASSWORD — validate token + set new password
  // ============================================================
  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { passwordResetToken: dto.token },
    });

    if (!user || !user.passwordResetExpiresAt) {
      throw new BadRequestException('Reset token is invalid or has already been used.');
    }

    if (new Date() > user.passwordResetExpiresAt) {
      // Clear the expired token
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordResetToken: null, passwordResetExpiresAt: null },
      });
      throw new BadRequestException(
        'Reset token has expired. Please initiate a new password reset request.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
        refreshTokenHash: null, // Invalidate all active sessions
      },
    });

    return { message: 'Password has been reset successfully. You can now log in.' };
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
