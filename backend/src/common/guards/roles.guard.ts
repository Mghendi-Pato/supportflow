import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Guards routes by checking the authenticated user's role.
 * Works in conjunction with @Roles() decorator.
 *
 * Role hierarchy:
 *   SUPER_ADMIN > WORKSPACE_ADMIN > AGENT > CLIENT
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();

    if (!user) throw new ForbiddenException('Access denied');

    // Super admins bypass all role restrictions
    if (user.platformRole === 'SUPER_ADMIN' || user.role === 'SUPER_ADMIN') {
      return true;
    }

    const hasRole = requiredRoles.some((role) => user.role === role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
