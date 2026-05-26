import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Ensures every request is scoped to the authenticated user's tenant.
 * Injects tenantId into the request object so services can use it directly.
 *
 * For SUPER_ADMIN:
 *   Priority order for tenantId resolution:
 *   1. X-Tenant-Override header  (set by frontend workspace selector)
 *   2. :tenantId route param
 *   3. ?tenantId query param
 *   4. null  →  platform-wide view
 *
 * CRITICAL: All database queries must use req.tenantId to prevent cross-tenant data leaks.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) throw new ForbiddenException('Not authenticated');

    // Super admins can access any tenant
    if (user.platformRole === 'SUPER_ADMIN' || user.role === 'SUPER_ADMIN') {
      const override = request.headers['x-tenant-override'] as string | undefined;
      const tenantId =
        (override && override.trim()) ||
        request.params?.tenantId ||
        request.query?.tenantId ||
        null;

      // Patch tenantId onto the user object so @CurrentUser() returns it consistently
      request.user = { ...user, tenantId: tenantId ?? null };
      request.tenantId = tenantId ?? null;
      return true;
    }

    // All other users must have a tenantId in their JWT
    if (!user.tenantId) {
      throw new ForbiddenException('No workspace associated with this account');
    }

    request.tenantId = user.tenantId;
    return true;
  }
}
