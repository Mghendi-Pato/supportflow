import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { TicketStatus } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // MAIN DASHBOARD — all 6 MVP metrics in one query
  // ============================================================
  async getDashboard(tenantId: string | null, currentUser: JwtPayload) {
    let clientId: string | undefined;
    let agentId: string | undefined;

    if (currentUser.role === 'CLIENT') {
      // Clients only see their own ticket data — require a real tenantId
      if (!tenantId) return this.emptyDashboard();
      const clientRecord = await this.prisma.client.findFirst({
        where: { userId: currentUser.sub, tenantId, deletedAt: null },
      });
      if (!clientRecord) return this.emptyDashboard();
      clientId = clientRecord.id;
    } else if (currentUser.role === 'AGENT') {
      // Agents only see tickets assigned to them
      agentId = currentUser.sub;
    }

    // SUPER_ADMIN has no tenantId — omit the filter to get a platform-wide view.
    // All other roles must have a valid tenantId at this point.
    const baseWhere = {
      ...(tenantId  && { tenantId }),
      deletedAt: null,
      ...(clientId  && { clientId }),
      ...(agentId   && { assignedTo: agentId }),
    };

    // Run all queries in parallel for performance
    const [
      totalTickets,
      openTickets,
      inProgressTickets,
      waitingTickets,
      fixedTickets,
      closedTickets,
      resolutionData,
      byClientRaw,
      recentTickets,
    ] = await Promise.all([
      // 1. Total
      this.prisma.ticket.count({ where: baseWhere }),

      // 2. By status (individual counts for dashboard cards)
      this.prisma.ticket.count({ where: { ...baseWhere, status: TicketStatus.OPEN } }),
      this.prisma.ticket.count({ where: { ...baseWhere, status: TicketStatus.IN_PROGRESS } }),
      this.prisma.ticket.count({ where: { ...baseWhere, status: TicketStatus.WAITING } }),
      this.prisma.ticket.count({ where: { ...baseWhere, status: TicketStatus.FIXED } }),
      this.prisma.ticket.count({ where: { ...baseWhere, status: TicketStatus.CLOSED } }),

      // 3. Avg resolution time — only from closed tickets that have closedAt set
      this.prisma.ticket.findMany({
        where: { ...baseWhere, closedAt: { not: null } },
        select: { createdAt: true, closedAt: true },
      }),

      // 4. Tickets per client — shown to admins AND agents (filtered by baseWhere)
      clientId
        ? Promise.resolve([])
        : this.prisma.ticket.groupBy({
            by: ['clientId'],
            where: { ...baseWhere },
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 10,
          }),

      // 5. Recent 5 tickets for quick view
      this.prisma.ticket.findMany({
        where: baseWhere,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          ticketNumber: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
          client: { select: { contactName: true, companyName: true } },
          assignee: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    // Compute average resolution time in hours
    const avgResolutionHours = this.computeAvgResolutionHours(resolutionData);

    // Enrich per-client data with names (admin + agents see their own clients)
    const byClient = clientId ? [] : await this.enrichClientStats(tenantId ?? null, byClientRaw);

    // Status breakdown array (for charts)
    const byStatus = [
      { status: TicketStatus.OPEN, count: openTickets, label: 'Open' },
      { status: TicketStatus.IN_PROGRESS, count: inProgressTickets, label: 'Ongoing' },
      { status: TicketStatus.WAITING, count: waitingTickets, label: 'Waiting' },
      { status: TicketStatus.FIXED, count: fixedTickets, label: 'Fixed' },
      { status: TicketStatus.CLOSED, count: closedTickets, label: 'Closed' },
    ];

    return {
      summary: {
        totalTickets,
        openTickets,
        closedTickets,
        avgResolutionHours:
          avgResolutionHours !== null
            ? Math.round(avgResolutionHours * 10) / 10
            : null,
      },
      byStatus,
      byClient,
      recentTickets,
    };
  }

  // ============================================================
  // TICKET TREND — open vs closed per day (last 30 days)
  // ============================================================
  async getTicketTrend(tenantId: string | null, currentUser: JwtPayload, days = 30) {
    // Clients not allowed to see trends
    if (currentUser.role === 'CLIENT') throw new ForbiddenException('Access denied');

    const since = new Date();
    since.setDate(since.getDate() - days);

    const tickets = await this.prisma.ticket.findMany({
      where: {
        ...(tenantId && { tenantId }),
        deletedAt: null,
        createdAt: { gte: since },
        // Agents only see their own assigned tickets in the trend
        ...(currentUser.role === 'AGENT' && { assignedTo: currentUser.sub }),
      },
      select: { createdAt: true, closedAt: true, status: true },
    });

    // Group by date
    const map: Record<string, { date: string; created: number; closed: number }> = {};

    tickets.forEach((t) => {
      const dateKey = t.createdAt.toISOString().slice(0, 10); // YYYY-MM-DD
      if (!map[dateKey]) map[dateKey] = { date: dateKey, created: 0, closed: 0 };
      map[dateKey].created++;
    });

    tickets.forEach((t) => {
      if (t.closedAt) {
        const dateKey = t.closedAt.toISOString().slice(0, 10);
        if (!map[dateKey]) map[dateKey] = { date: dateKey, created: 0, closed: 0 };
        map[dateKey].closed++;
      }
    });

    // Return sorted by date ascending
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }

  // ============================================================
  // AGENT WORKLOAD — tickets per agent (admin only)
  // ============================================================
  async getAgentWorkload(tenantId: string | null, currentUser: JwtPayload) {
    if (!['WORKSPACE_ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      throw new ForbiddenException('Access denied');
    }

    const grouped = await this.prisma.ticket.groupBy({
      by: ['assignedTo', 'status'],
      where: { ...(tenantId && { tenantId }), deletedAt: null, assignedTo: { not: null } },
      _count: { id: true },
    });

    // Enrich with user names
    const agentIds = [...new Set(grouped.map((g) => g.assignedTo).filter(Boolean))] as string[];
    const agents = await this.prisma.user.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, firstName: true, lastName: true, avatarUrl: true },
    });
    const agentMap = Object.fromEntries(agents.map((a) => [a.id, a]));

    // Aggregate per agent
    const agentWorkload: Record<string, any> = {};
    grouped.forEach(({ assignedTo, status, _count }) => {
      if (!assignedTo) return;
      if (!agentWorkload[assignedTo]) {
        agentWorkload[assignedTo] = {
          agent: agentMap[assignedTo] ?? { id: assignedTo },
          total: 0,
          byStatus: {},
        };
      }
      agentWorkload[assignedTo].total += _count.id;
      agentWorkload[assignedTo].byStatus[status] = _count.id;
    });

    return Object.values(agentWorkload).sort((a, b) => b.total - a.total);
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private computeAvgResolutionHours(
    tickets: { createdAt: Date; closedAt: Date | null }[],
  ): number | null {
    // Only use tickets where closedAt is genuinely after createdAt
    const valid = tickets.filter((t) => t.closedAt !== null);
    if (!valid.length) return null;   // null = "not enough data" (shown as "—" on frontend)
    const totalMs = valid.reduce(
      (sum, t) => sum + Math.abs(t.closedAt!.getTime() - t.createdAt.getTime()),
      0,
    );
    return totalMs / valid.length / (1000 * 60 * 60); // ms → hours
  }

  private async enrichClientStats(
    tenantId: string | null,
    raw: { clientId: string; _count: { id: number } }[],
  ) {
    if (!raw.length) return [];
    const clientIds = raw.map((r) => r.clientId);
    const clients = await this.prisma.client.findMany({
      where: {
        id: { in: clientIds },
        ...(tenantId && { tenantId }),
      },
      select: { id: true, contactName: true, companyName: true },
    });
    const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]));
    return raw.map((r) => ({
      clientId: r.clientId,
      contactName: clientMap[r.clientId]?.contactName ?? 'Unknown',
      companyName: clientMap[r.clientId]?.companyName ?? null,
      ticketCount: r._count.id,
    }));
  }

  private emptyDashboard() {
    return {
      summary: { totalTickets: 0, openTickets: 0, closedTickets: 0, avgResolutionHours: 0 },
      byStatus: [],
      byClient: [],
      recentTickets: [],
    };
  }
}
