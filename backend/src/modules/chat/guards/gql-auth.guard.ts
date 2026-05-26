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

    // For HTTP query/mutation: token is in the Authorization header.
    // For WebSocket subscription: req is undefined; the token was extracted
    // in onConnect (app.module.ts) and stored as gqlCtx.token.
    const request = gqlCtx.req;
    let authHeader: string;
    if (request) {
      authHeader = request.headers?.authorization ?? '';
    } else {
      // WebSocket context — token from connectionParams via onConnect
      authHeader = gqlCtx.token ? `Bearer ${gqlCtx.token}` : '';
    }
    const token = this.extractToken(authHeader);

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
