import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ListTicketsDto } from './dto/list-tickets.dto';
import { Prisma, TicketStatus, CommentType } from '@prisma/client';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

// Fields included in every ticket query
const TICKET_INCLUDE = {
  client: {
    select: { id: true, contactName: true, companyName: true, email: true },
  },
  assignee: {
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  },
  creator: {
    select: { id: true, firstName: true, lastName: true },
  },
  _count: { select: { comments: true, attachments: true } },
} satisfies Prisma.TicketInclude;

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ============================================================
  // CREATE TICKET
  // ============================================================
  async create(tenantId: string, currentUser: JwtPayload, dto: CreateTicketDto) {
    let clientId: string;
    const isClient = currentUser.role === 'CLIENT';
    const createdByType = isClient ? 'client' : 'agent';

    if (isClient) {
      // Client creates ticket for themselves — resolve clientId from their record
      const clientRecord = await this.prisma.client.findFirst({
        where: { userId: currentUser.sub, tenantId, deletedAt: null },
      });
      if (!clientRecord) throw new ForbiddenException('Client record not found');
      clientId = clientRecord.id;
    } else {
      // Agent/admin must specify which client this ticket is for
      if (!dto.clientId) {
        throw new BadRequestException('clientId is required when creating a ticket on behalf of a client');
      }
      const clientRecord = await this.prisma.client.findFirst({
        where: { id: dto.clientId, tenantId, deletedAt: null },
      });
      if (!clientRecord) throw new NotFoundException('Client not found in this workspace');
      clientId = clientRecord.id;
    }

    // Validate assignee belongs to this tenant
    if (dto.assignedTo) {
      const agent = await this.prisma.tenantMember.findFirst({
        where: { tenantId, userId: dto.assignedTo, isActive: true },
      });
      if (!agent) throw new BadRequestException('Assigned user is not a member of this workspace');
    }

    // Generate atomic ticket number (e.g. SUP-1042)
    const ticketNumber = await this.prisma.getNextTicketNumber(tenantId);

    // Default: staff-created tickets are auto-assigned to the creator
    const resolvedAssignedTo = isClient
      ? (dto.assignedTo ?? null)
      : (dto.assignedTo ?? currentUser.sub);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ticket: any = await this.prisma.ticket.create({
      data: {
        tenantId,
        ticketNumber,
        clientId,
        title: dto.title,
        description: dto.description,
        priority: dto.priority ?? 'MEDIUM',
        assignedTo: resolvedAssignedTo,
        // assignedAt is new — cast data to bypass stale Prisma client types
        // until `npx prisma generate` is run locally after migration
        ...({ assignedAt: resolvedAssignedTo ? new Date() : null } as object),
        createdByUserId: currentUser.sub,
        createdByType,
        status: 'OPEN',
      } as any,
      include: {
        ...TICKET_INCLUDE,
        client: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        assignee: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
      },
    });

    // Activity log
    await this.logActivity(ticket.id, tenantId, currentUser.sub, 'TICKET_CREATED');

    // Resolve tenant name for notifications
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    const ticketCtx = {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      ticketTitle: ticket.title,
      tenantId,
      tenantName: tenant!.name,
    };

    const clientParticipant = ticket.client.user
      ? {
          userId: ticket.client.user.id,
          firstName: ticket.client.user.firstName,
          lastName: ticket.client.user.lastName,
          email: ticket.client.user.email,
        }
      : null;

    const assigneeParticipant = ticket.assignee
      ? {
          userId: (ticket.assignee as any).id,
          firstName: (ticket.assignee as any).firstName,
          lastName: (ticket.assignee as any).lastName,
          email: (ticket.assignee as any).email,
        }
      : null;

    // Fire notifications asynchronously — don't block the response
    if (clientParticipant) {
      this.notifications
        .onTicketCreated(ticketCtx, clientParticipant, currentUser.sub, assigneeParticipant)
        .catch(() => {});
    }

    return ticket;
  }

  // ============================================================
  // LIST TICKETS
  // ============================================================
  async findAll(tenantId: string, currentUser: JwtPayload, query: ListTicketsDto) {
    const { page = 1, limit = 20, status, statuses, priority, clientId, assignedTo, search, sortBy = 'createdAt', sortOrder = 'desc', from, to } = query;
    const skip = (page - 1) * limit;

    // `statuses` (multi-value) takes precedence over single `status`
    const statusFilter: Prisma.TicketWhereInput =
      statuses?.length
        ? { status: { in: statuses } }
        : status
        ? { status }
        : {};

    const where: Prisma.TicketWhereInput = {
      tenantId,
      deletedAt: null,
      ...statusFilter,
      ...(priority && { priority }),
      ...(assignedTo && { assignedTo }),
      ...((from || to) && {
        createdAt: {
          ...(from && { gte: new Date(from) }),
          ...(to   && { lte: new Date(to) }),
        },
      }),
      ...(search && {
        OR: [
          { ticketNumber: { contains: search, mode: 'insensitive' } },
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    // Role-based scoping
    if (currentUser.role === 'CLIENT') {
      // Clients only see their own tickets
      const clientRecord = await this.prisma.client.findFirst({
        where: { userId: currentUser.sub, tenantId },
      });
      if (!clientRecord) return { data: [], total: 0, page, limit, totalPages: 0 };
      where.clientId = clientRecord.id;
    } else if (currentUser.role === 'AGENT') {
      // Agents only see tickets assigned to them — ignore any assignedTo query param
      where.assignedTo = currentUser.sub;
    } else if (clientId) {
      // Admins can filter by client
      where.clientId = clientId;
    }

    // Allowed sort fields
    const allowedSortFields = ['createdAt', 'updatedAt', 'priority', 'status', 'ticketNumber'];
    const orderByField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderByField]: sortOrder },
        include: TICKET_INCLUDE,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      data: tickets,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ============================================================
  // GET SINGLE TICKET — with comments, attachments, activity log
  // ============================================================
  async findOne(tenantId: string, currentUser: JwtPayload, ticketIdOrNumber: string) {
    // Support both UUID and ticket number (SUP-1042)
    const isTicketNumber = ticketIdOrNumber.includes('-') && !ticketIdOrNumber.includes('-', 4);
    const where = isTicketNumber
      ? { tenantId, ticketNumber: ticketIdOrNumber.toUpperCase(), deletedAt: null }
      : { id: ticketIdOrNumber, tenantId, deletedAt: null };

    const ticket = await this.prisma.ticket.findFirst({
      where,
      include: {
        ...TICKET_INCLUDE,
        attachments: {
          orderBy: { createdAt: 'asc' },
        },
        activityLogs: {
          include: {
            actor: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');

    // Enforce client isolation
    if (currentUser.role === 'CLIENT') {
      await this.assertClientOwnsTicket(tenantId, currentUser.sub, ticket.clientId);
    }

    // Fetch comments — filter internal notes if requester is a client
    const commentWhere: Prisma.TicketCommentWhereInput = {
      ticketId: ticket.id,
      deletedAt: null,
      ...(currentUser.role === 'CLIENT' && { commentType: CommentType.PUBLIC }),
    };

    const comments = await this.prisma.ticketComment.findMany({
      where: commentWhere,
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        attachments: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return { ...ticket, comments };
  }

  // ============================================================
  // UPDATE TICKET — title, description, priority
  // ============================================================
  async update(tenantId: string, currentUser: JwtPayload, ticketId: string, dto: UpdateTicketDto) {
    const ticket = await this.assertTicketAccess(tenantId, currentUser, ticketId);

    const prevPriority = ticket.priority;

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description && { description: dto.description }),
        ...(dto.priority && { priority: dto.priority }),
      },
      include: TICKET_INCLUDE,
    });

    // Log priority change if it changed
    if (dto.priority && dto.priority !== prevPriority) {
      await this.logActivity(ticketId, tenantId, currentUser.sub, 'PRIORITY_CHANGED', prevPriority, dto.priority);
    }

    return updated;
  }

  // ============================================================
  // CHANGE STATUS — dedicated endpoint with full notification flow
  // ============================================================
  async changeStatus(tenantId: string, currentUser: JwtPayload, ticketId: string, dto: ChangeStatusDto) {
    const ticket = await this.assertTicketAccess(tenantId, currentUser, ticketId, ['WORKSPACE_ADMIN', 'AGENT']);

    if (ticket.status === dto.status) {
      throw new BadRequestException(`Ticket is already ${dto.status}`);
    }

    // Clients cannot change status
    if (currentUser.role === 'CLIENT') {
      throw new ForbiddenException('Clients cannot change ticket status');
    }

    const prevStatus = ticket.status;
    const isClosing = dto.status === TicketStatus.CLOSED;

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: dto.status,
        ...(isClosing && { closedAt: new Date() }),
        // Reopen: clear closedAt if moving out of CLOSED
        ...(!isClosing && ticket.status === TicketStatus.CLOSED && { closedAt: null }),
      },
      include: {
        ...TICKET_INCLUDE,
        client: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        assignee: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
      },
    });

    const action = ticket.status === TicketStatus.CLOSED ? 'TICKET_REOPENED' : isClosing ? 'TICKET_CLOSED' : 'STATUS_CHANGED';
    await this.logActivity(ticketId, tenantId, currentUser.sub, action, prevStatus, dto.status);

    // If a note was provided, log it as an internal comment
    if (dto.note) {
      await this.prisma.ticketComment.create({
        data: {
          tenantId,
          ticketId,
          authorUserId: currentUser.sub,
          content: dto.note,
          commentType: CommentType.INTERNAL,
        },
      });
    }

    // Get context for notifications
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
    const ticketCtx = { ticketId: ticket.id, ticketNumber: ticket.ticketNumber, ticketTitle: ticket.title, tenantId, tenantName: tenant!.name };

    const clientUser = (updated.client as any).user;
    const clientParticipant = clientUser
      ? { userId: clientUser.id, firstName: clientUser.firstName, lastName: clientUser.lastName, email: clientUser.email }
      : null;

    const assigneeParticipant = updated.assignee
      ? { userId: (updated.assignee as any).id, firstName: (updated.assignee as any).firstName, lastName: (updated.assignee as any).lastName, email: (updated.assignee as any).email }
      : null;

    if (clientParticipant) {
      if (isClosing) {
        this.notifications.onTicketClosed(ticketCtx, clientParticipant, currentUser.sub).catch(() => {});
      } else {
        this.notifications.onStatusChanged(ticketCtx, prevStatus, dto.status, currentUser.sub, clientParticipant, assigneeParticipant).catch(() => {});
      }
    }

    return updated;
  }

  // ============================================================
  // ASSIGN TICKET
  // ============================================================
  async assign(tenantId: string, currentUser: JwtPayload, ticketId: string, dto: AssignTicketDto) {
    // Only admins can assign/reassign tickets
    if (currentUser.role === 'AGENT') {
      throw new ForbiddenException('Agents cannot assign tickets');
    }
    const ticket = await this.assertTicketAccess(tenantId, currentUser, ticketId, ['WORKSPACE_ADMIN']);

    // Validate the new assignee is a workspace member
    if (dto.assignedTo) {
      const member = await this.prisma.tenantMember.findFirst({
        where: { tenantId, userId: dto.assignedTo, isActive: true },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      });
      if (!member) throw new BadRequestException('Assigned user is not a member of this workspace');

      const prevAssigneeName = ticket.assignedTo ? await this.getUserName(ticket.assignedTo) : null;
      const newAssigneeName = `${member.user.firstName} ${member.user.lastName}`;

      await this.prisma.ticket.update({ where: { id: ticketId }, data: { assignedTo: dto.assignedTo, ...({ assignedAt: new Date() } as object) } as any });
      await this.logActivity(ticketId, tenantId, currentUser.sub, 'ASSIGNED', prevAssigneeName ?? undefined, newAssigneeName);

      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
      const ticketCtx = { ticketId: ticket.id, ticketNumber: ticket.ticketNumber, ticketTitle: ticket.title, tenantId, tenantName: tenant!.name };
      this.notifications.onTicketAssigned(ticketCtx, { userId: member.user.id, firstName: member.user.firstName, lastName: member.user.lastName, email: member.user.email }).catch(() => {});
    } else {
      // Unassign
      const prevAssigneeName = ticket.assignedTo ? await this.getUserName(ticket.assignedTo) : null;
      await this.prisma.ticket.update({ where: { id: ticketId }, data: { assignedTo: null, ...({ assignedAt: null } as object) } as any });
      await this.logActivity(ticketId, tenantId, currentUser.sub, 'UNASSIGNED', prevAssigneeName ?? undefined);
    }

    return this.prisma.ticket.findUnique({ where: { id: ticketId }, include: TICKET_INCLUDE });
  }

  // ============================================================
  // SOFT DELETE
  // ============================================================
  async remove(tenantId: string, currentUser: JwtPayload, ticketId: string) {
    await this.assertTicketAccess(tenantId, currentUser, ticketId, ['WORKSPACE_ADMIN']);
    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: { deletedAt: new Date() },
    });
  }

  // ============================================================
  // ADD COMMENT / INTERNAL NOTE
  // ============================================================
  async addComment(tenantId: string, currentUser: JwtPayload, ticketId: string, dto: CreateCommentDto) {
    const ticket = await this.assertTicketAccess(tenantId, currentUser, ticketId);

    // Clients can only post PUBLIC comments
    if (currentUser.role === 'CLIENT' && dto.commentType === CommentType.INTERNAL) {
      throw new ForbiddenException('Clients cannot post internal notes');
    }

    const commentType = dto.commentType ?? CommentType.PUBLIC;

    const comment = await this.prisma.ticketComment.create({
      data: {
        tenantId,
        ticketId,
        authorUserId: currentUser.sub,
        content: dto.content,
        commentType,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    const action = commentType === CommentType.INTERNAL ? 'INTERNAL_NOTE_ADDED' : 'COMMENT_ADDED';
    await this.logActivity(ticketId, tenantId, currentUser.sub, action, undefined, commentType.toLowerCase());

    // Notify participants
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
    const ticketCtx = { ticketId: ticket.id, ticketNumber: ticket.ticketNumber, ticketTitle: ticket.title, tenantId, tenantName: tenant!.name };
    this.notifications.onNewComment(ticketCtx, currentUser.sub, commentType, dto.content).catch(() => {});

    return comment;
  }

  // ============================================================
  // UPDATE COMMENT — author only
  // ============================================================
  async updateComment(tenantId: string, currentUser: JwtPayload, ticketId: string, commentId: string, content: string) {
    await this.assertTicketAccess(tenantId, currentUser, ticketId);

    const comment = await this.prisma.ticketComment.findFirst({
      where: { id: commentId, ticketId, deletedAt: null },
    });

    if (!comment) throw new NotFoundException('Comment not found');

    // Only the author can edit their own comment
    if (comment.authorUserId !== currentUser.sub && currentUser.role !== 'WORKSPACE_ADMIN') {
      throw new ForbiddenException('You can only edit your own comments');
    }

    return this.prisma.ticketComment.update({
      where: { id: commentId },
      data: { content },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
  }

  // ============================================================
  // DELETE COMMENT — soft delete, author or admin only
  // ============================================================
  async deleteComment(tenantId: string, currentUser: JwtPayload, ticketId: string, commentId: string) {
    await this.assertTicketAccess(tenantId, currentUser, ticketId);

    const comment = await this.prisma.ticketComment.findFirst({
      where: { id: commentId, ticketId, deletedAt: null },
    });

    if (!comment) throw new NotFoundException('Comment not found');

    if (comment.authorUserId !== currentUser.sub && currentUser.role !== 'WORKSPACE_ADMIN') {
      throw new ForbiddenException('You can only delete your own comments');
    }

    return this.prisma.ticketComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });
  }

  // ============================================================
  // ACTIVITY LOG
  // ============================================================
  async getActivityLog(tenantId: string, currentUser: JwtPayload, ticketId: string) {
    await this.assertTicketAccess(tenantId, currentUser, ticketId);

    return this.prisma.ticketActivityLog.findMany({
      where: { ticketId, tenantId },
      include: {
        actor: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private async assertTicketAccess(
    tenantId: string,
    currentUser: JwtPayload,
    ticketId: string,
    allowedRoles?: string[],
  ) {
    if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }

    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId, deletedAt: null },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');

    // Client isolation — clients can only access their own tickets
    if (currentUser.role === 'CLIENT') {
      await this.assertClientOwnsTicket(tenantId, currentUser.sub, ticket.clientId);
    }

    return ticket;
  }

  private async assertClientOwnsTicket(tenantId: string, userId: string, ticketClientId: string) {
    const clientRecord = await this.prisma.client.findFirst({
      where: { userId, tenantId, deletedAt: null },
    });
    if (!clientRecord || clientRecord.id !== ticketClientId) {
      throw new ForbiddenException('You do not have access to this ticket');
    }
  }

  private async logActivity(
    ticketId: string,
    tenantId: string,
    actorUserId: string,
    action: string,
    fromValue?: string,
    toValue?: string,
    metadata: Record<string, unknown> = {},
  ) {
    await this.prisma.ticketActivityLog.create({
      data: {
        ticketId,
        tenantId,
        actorUserId,
        action: action as any,
        fromValue: fromValue ?? null,
        toValue: toValue ?? null,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }

  private async getUserName(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    return user ? `${user.firstName} ${user.lastName}` : null;
  }
}
