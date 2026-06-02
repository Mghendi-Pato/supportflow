import { Injectable, ForbiddenException } from '@nestjs/common';
import { TenantPlan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PLAN_LIMITS } from '../constants/plan-limits';

@Injectable()
export class PlanLimitService {
  constructor(private prisma: PrismaService) {}

  /** Throws if the tenant has reached its agent cap */
  async assertCanAddAgent(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { plan: true, _count: { select: { members: { where: { isActive: true } } } } },
    });
    const limit = PLAN_LIMITS[tenant.plan].maxAgents;
    if (limit !== null && tenant._count.members >= limit) {
      throw new ForbiddenException(
        `Your ${tenant.plan} plan allows a maximum of ${limit} agent${limit === 1 ? '' : 's'}. Please upgrade to add more.`,
      );
    }
  }

  /** Throws if the tenant has reached its client cap */
  async assertCanAddClient(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { plan: true, _count: { select: { clients: { where: { isActive: true } } } } },
    });
    const limit = PLAN_LIMITS[tenant.plan].maxClients;
    if (limit !== null && tenant._count.clients >= limit) {
      throw new ForbiddenException(
        `Your ${tenant.plan} plan allows a maximum of ${limit} client${limit === 1 ? '' : 's'}. Please upgrade to add more.`,
      );
    }
  }

  /** Throws if the tenant has reached its monthly ticket cap */
  async assertCanCreateTicket(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { plan: true },
    });
    const limit = PLAN_LIMITS[tenant.plan].maxTicketsPerMonth;
    if (limit === null) return;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const count = await this.prisma.ticket.count({
      where: {
        tenantId,
        createdAt: { gte: startOfMonth },
        deletedAt: null,
      },
    });

    if (count >= limit) {
      throw new ForbiddenException(
        `Your ${tenant.plan} plan allows a maximum of ${limit} tickets per month. Please upgrade to continue creating tickets.`,
      );
    }
  }

  /** Returns the file size + count limits for a tenant's plan */
  async getUploadLimits(tenantId: string) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { plan: true },
    });
    const limits = PLAN_LIMITS[tenant.plan];
    return {
      maxFileSizeBytes: limits.maxFileSizeBytes,
      maxFilesPerTicket: limits.maxFilesPerTicket,
    };
  }

  /** Throws if a feature is not available on the tenant's plan */
  async assertFeatureEnabled(
    tenantId: string,
    feature: keyof typeof PLAN_LIMITS[TenantPlan]['features'],
  ): Promise<void> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { plan: true },
    });
    if (!PLAN_LIMITS[tenant.plan].features[feature]) {
      throw new ForbiddenException(
        `The "${feature}" feature is not available on your current plan. Please upgrade to access it.`,
      );
    }
  }

  /** Returns full limits object for a plan */
  getLimitsForPlan(plan: TenantPlan) {
    return PLAN_LIMITS[plan];
  }
}
