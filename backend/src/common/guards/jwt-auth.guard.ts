import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { GqlContextType } from '@nestjs/graphql';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Skip for GraphQL — Passport's authenticate() crashes when it receives
    // undefined as the request (args[0] = GraphQL root for top-level ops).
    // Each GraphQL resolver that needs auth uses @UseGuards(GqlAuthGuard)
    // which reads the token directly from the GQL execution context.
    if (context.getType<GqlContextType>() === 'graphql') {
      return true;
    }

    // Allow routes marked with @Public() to bypass JWT check
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or expired token');
    }
    return user;
  }
}
