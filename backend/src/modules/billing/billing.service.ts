import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateBillingRequestDto } from './dto/create-billing-request.dto';
import { RespondBillingRequestDto } from './dto/respond-billing-request.dto';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ============================================================
  // CREATE — staff sends a billing request
  // Admins go straight to PENDING (visible to client).
  // Agents go to AWAITING_APPROVAL — admin must approve first.
  // ============================================================
  async create(tenantId: string, currentUser: JwtPayload, dto: CreateBillingRequestDto) {
    const isAdmin = ['WORKSPACE_ADMIN', 'SUPER_ADMIN'].includes(currentUser.role);

    const ticket = await this.prisma.ticket.findFirst({
      where: { id: dto.ticketId, tenantId, deletedAt: null },
      select: {
        id: true, clientId: true, status: true,
        ticketNumber: true, title: true,
        tenant: { select: { id: true, name: true } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.status === 'CLOSED') {
      throw new BadRequestException('Cannot add a billing request to a closed ticket');
    }

    const initialStatus = isAdmin ? 'PENDING' : 'AWAITING_APPROVAL';

    const billing = await this.prisma.billingRequest.create({
      data: {
        tenantId,
        ticketId: ticket.id,
        clientId: ticket.clientId,
        requestedById: currentUser.sub,
        amount: dto.amount,
        currency: dto.currency ?? 'KES',
        description: dto.description,
        status: initialStatus,
      },
      include: {
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
        client: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    if (isAdmin) {
      // Admin-created → notify client immediately
      if (billing.client.user) {
        this.notifications.onBillingRequestCreated(
          {
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            ticketTitle: ticket.title,
            tenantId,
            tenantName: ticket.tenant.name,
          },
          {
            userId: billing.client.user.id,
            firstName: billing.client.user.firstName,
            lastName: billing.client.user.lastName,
            email: billing.client.user.email,
          },
          dto.amount.toString(),
          dto.currency ?? 'KES',
          dto.description,
        ).catch(() => {/* swallow */});
      }
    } else {
      // Agent-created → notify workspace admins to review
      this.notifications.onBillingApprovalNeeded(
        {
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          ticketTitle: ticket.title,
          tenantId,
          tenantName: ticket.tenant.name,
        },
        billing.requestedBy,
        dto.amount.toString(),
        dto.currency ?? 'KES',
        dto.description,
      ).catch(() => {/* swallow */});
    }

    return billing;
  }

  // ============================================================
  // APPROVE — admin approves an agent-submitted billing request,
  // moving it from AWAITING_APPROVAL → PENDING so the client sees it.
  // ============================================================
  async approve(requestId: string, currentUser: JwtPayload) {
    const isAdmin = ['WORKSPACE_ADMIN', 'SUPER_ADMIN'].includes(currentUser.role);
    if (!isAdmin) throw new ForbiddenException('Only admins can approve billing requests');

    const request = await this.prisma.billingRequest.findUnique({
      where: { id: requestId },
      include: {
        client: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        ticket: {
          select: {
            id: true, ticketNumber: true, title: true, tenantId: true,
            tenant: { select: { name: true } },
          },
        },
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!request) throw new NotFoundException('Billing request not found');
    if (request.tenantId !== currentUser.tenantId) throw new ForbiddenException();
    if (request.status !== 'AWAITING_APPROVAL') {
      throw new BadRequestException(`Request is already ${request.status.toLowerCase().replace(/_/g, ' ')}`);
    }

    const updated = await this.prisma.billingRequest.update({
      where: { id: requestId },
      data: { status: 'PENDING' },
      include: {
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Now notify the client
    if (request.client.user) {
      this.notifications.onBillingRequestCreated(
        {
          ticketId: request.ticket.id,
          ticketNumber: request.ticket.ticketNumber,
          ticketTitle: request.ticket.title,
          tenantId: request.ticket.tenantId,
          tenantName: request.ticket.tenant.name,
        },
        {
          userId: request.client.user.id,
          firstName: request.client.user.firstName,
          lastName: request.client.user.lastName,
          email: request.client.user.email,
        },
        request.amount.toString(),
        request.currency,
        request.description,
      ).catch(() => {/* swallow */});
    }

    return updated;
  }

  // ============================================================
  // RESPOND — client accepts or declines (only PENDING requests)
  // ============================================================
  async respond(requestId: string, currentUser: JwtPayload, dto: RespondBillingRequestDto) {
    const request = await this.prisma.billingRequest.findUnique({
      where: { id: requestId },
      include: {
        client: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        ticket: {
          select: {
            id: true, ticketNumber: true, title: true, tenantId: true,
            tenant: { select: { name: true } },
          },
        },
        requestedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!request) throw new NotFoundException('Billing request not found');
    if (request.client.userId !== currentUser.sub) {
      throw new ForbiddenException('Only the client can respond to this billing request');
    }
    if (request.status !== 'PENDING') {
      throw new BadRequestException(`This request has already been ${request.status.toLowerCase().replace(/_/g, ' ')}`);
    }
    if (!dto.accept && !dto.declineReason?.trim()) {
      throw new BadRequestException('A reason is required when declining');
    }

    const updated = await this.prisma.billingRequest.update({
      where: { id: requestId },
      data: {
        status: dto.accept ? 'ACCEPTED' : 'DECLINED',
        acceptedAt: dto.accept ? new Date() : null,
        declinedAt: dto.accept ? null : new Date(),
        declineReason: dto.accept ? null : dto.declineReason,
      },
      include: {
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Mark ticket as paid when client accepts
    if (dto.accept) {
      await this.prisma.ticket.update({
        where: { id: request.ticketId },
        data: { isPaid: true },
      });
    }

    // Notify the requester (staff member)
    const clientName = request.client.user
      ? `${request.client.user.firstName} ${request.client.user.lastName}`
      : 'The client';

    this.notifications.onPaymentResponded(
      {
        ticketId: request.ticket.id,
        ticketNumber: request.ticket.ticketNumber,
        ticketTitle: request.ticket.title,
        tenantId: request.ticket.tenantId,
        tenantName: request.ticket.tenant.name,
      },
      {
        userId: request.requestedBy.id,
        firstName: request.requestedBy.firstName,
        lastName: request.requestedBy.lastName,
        email: request.requestedBy.email,
      },
      dto.accept,
      clientName,
      dto.declineReason,
    ).catch(() => {/* swallow */});

    return updated;
  }

  // ============================================================
  // LIST FOR TICKET
  // Clients only see PENDING / ACCEPTED / DECLINED (not AWAITING_APPROVAL).
  // Staff see everything.
  // ============================================================
  async getForTicket(tenantId: string | null, ticketId: string, currentUser: JwtPayload) {
    const isClient = currentUser.role === 'CLIENT';

    return this.prisma.billingRequest.findMany({
      where: {
        ...(tenantId && { tenantId }),
        ticketId,
        ...(isClient && {
          status: { notIn: ['AWAITING_APPROVAL'] },
        }),
      },
      orderBy: { createdAt: 'asc' },
      include: {
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  // ============================================================
  // SPENDING SUMMARY
  // ============================================================
  async getSpendingSummary(
    tenantId: string,
    currentUser: JwtPayload,
    from?: string,
    to?: string,
  ) {
    const clientRecord = await this.prisma.client.findFirst({
      where: { userId: currentUser.sub, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!clientRecord) throw new ForbiddenException('No client record found');

    const where: any = { tenantId, clientId: clientRecord.id, status: 'ACCEPTED' };
    if (from || to) {
      where.acceptedAt = {};
      if (from) where.acceptedAt.gte = new Date(from);
      if (to)   where.acceptedAt.lte = new Date(to);
    }

    const requests = await this.prisma.billingRequest.findMany({
      where,
      orderBy: { acceptedAt: 'desc' },
      include: {
        ticket: { select: { id: true, ticketNumber: true, title: true } },
        requestedBy: { select: { firstName: true, lastName: true } },
      },
    });

    const totals: Record<string, number> = {};
    requests.forEach((r) => {
      const cur = r.currency;
      totals[cur] = (totals[cur] ?? 0) + Number(r.amount);
    });

    return { requests, totals, count: requests.length };
  }
}
