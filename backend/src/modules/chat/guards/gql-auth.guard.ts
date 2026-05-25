import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GqlAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const ctx = GqlExecutionContext.create(context);
    const gqlCtx = ctx.getContext();

    // For HTTP (query/mutation): token in Authorization header
    const request = gqlCtx.req;
    const token = this.extractToken(request?.headers?.authorization ?? '');

    if (!token) throw new UnauthorizedException('No auth token');

    try {
      const payload = this.jwt.verify(token, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
      });
      // Attach user to context
      gqlCtx.user = { userId: payload.sub, role: payload.role, tenantId: payload.tenantId };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(authorization: string): string | null {
    if (!authorization.startsWith('Bearer ')) return null;
    return authorization.slice(7).trim() || null;
  }
}
