import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;         // user id
  email: string;
  platformRole: string;
  tenantId: string | null;
  role: string;        // resolved role: SUPER_ADMIN | WORKSPACE_ADMIN | AGENT | CLIENT
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET'),
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload) {
    // Verify user still exists and is active on every request
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub, deletedAt: null },
      select: { id: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account not found or deactivated');
    }

    // Attach full payload to request — guards and decorators use this
    return payload;
  }
}
