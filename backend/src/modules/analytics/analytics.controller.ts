import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(TenantGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * GET /analytics/dashboard
   * Main dashboard: summary cards, status breakdown, per-client stats, recent tickets.
   * Clients see only their own ticket data.
   */
  @Get('dashboard')
  @Roles('WORKSPACE_ADMIN', 'AGENT', 'CLIENT')
  @ApiOperation({ summary: 'Get dashboard analytics (role-scoped)' })
  getDashboard(@CurrentUser() user: JwtPayload) {
    return this.analyticsService.getDashboard(user.tenantId ?? null, user);
  }

  /**
   * GET /analytics/trend
   * Ticket creation vs closure trend over the last N days. Staff only.
   */
  @Get('trend')
  @Roles('WORKSPACE_ADMIN', 'AGENT')
  @ApiQuery({ name: 'days', required: false, example: 30 })
  @ApiOperation({ summary: 'Ticket trend over time (staff only)' })
  getTicketTrend(@CurrentUser() user: JwtPayload, @Query('days') days?: number) {
    return this.analyticsService.getTicketTrend(user.tenantId ?? null, user, days ? Number(days) : 30);
  }

  /**
   * GET /analytics/agent-workload
   * Per-agent ticket counts by status. Admin only.
   */
  @Get('agent-workload')
  @Roles('WORKSPACE_ADMIN')
  @ApiOperation({ summary: 'Agent workload breakdown (admin only)' })
  getAgentWorkload(@CurrentUser() user: JwtPayload) {
    return this.analyticsService.getAgentWorkload(user.tenantId ?? null, user);
  }
}
