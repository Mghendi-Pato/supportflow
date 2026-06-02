import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantPlan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Decorator: @RequiresPlan('STANDARD', 'PREMIUM') */
export const REQUIRED_PLANS_KEY = 'requiredPlans';
export const RequiresPlan = (...plans: TenantPlan[]) =>
  SetMetadata(REQUIRED_PLANS_KEY, plans);

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPlans = this.reflector.getAllAndOverride<TenantPlan[]>(
      REQUIRED_PLANS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPlans || requiredPlans.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const tenantId: string | null = request.user?.tenantId;

    if (!tenantId) {
      throw new ForbiddenException('No workspace context found.');
    }

    // Always fetch fresh from DB — ensures plan downgrades take effect immediately
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    });

    if (!tenant || !requiredPlans.includes(tenant.plan)) {
      throw new ForbiddenException(
        `Your current plan does not include this feature. Please upgrade to ${requiredPlans.join(' or ')}.`,
      );
    }

    return true;
  }
}
