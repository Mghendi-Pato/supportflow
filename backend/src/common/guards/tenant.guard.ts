import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Ensures every request is scoped to the authenticated user's tenant.
 * Injects tenantId into the request object so services can use it directly.
 *
 * CRITICAL: All database queries must use req.tenantId to prevent cross-tenant data leaks.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) throw new ForbiddenException('Not authenticated');

    // Super admins can access any tenant — tenantId comes from route param or query
    if (user.platformRole === 'SUPER_ADMIN') {
      request.tenantId = request.params.tenantId || request.query.tenantId || null;
      return true;
    }

    // All other users must have a tenantId from their JWT
    if (!user.tenantId) {
      throw new ForbiddenException('No workspace associated with this account');
    }

    request.tenantId = user.tenantId;
    return true;
  }
}
