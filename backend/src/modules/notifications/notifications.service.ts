import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from './email/email.service';
import { UpdateNotificationPrefsDto } from './dto/update-notification-prefs.dto';

interface TicketContext {
  ticketId: string;
  ticketNumber: string;
  ticketTitle: string;
  tenantId: string;
  tenantName: string;
}

interface Participant {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  }

  // ============================================================
  // TRIGGER 1 — TICKET CREATED
  // Recipients: workspace admin(s) + assigned agent + client (confirmation)
  // ============================================================
  async onTicketCreated(
    ticket: TicketContext,
    client: Participant,
    createdByUserId: string,
    assignedAgent: Participant | null,
  ) {
    const ticketUrl = this.buildTicketUrl(ticket.ticketNumber);
    const recipients: { user: Participant; isClient: boolean }[] = [];

    // Always notify the client (confirmation their ticket was received)
    recipients.push({ user: client, isClient: true });

    // Notify assigned agent (if different from creator)
    if (assignedAgent && assignedAgent.userId !== createdByUserId) {
      recipients.push({ user: assignedAgent, isClient: false });
    }

    // Notify workspace admins
    const admins = await this.getWorkspaceAdmins(ticket.tenantId, [
      createdByUserId,
      assignedAgent?.userId,
    ]);
    admins.forEach((admin) => recipients.push({ user: admin, isClient: false }));

    await Promise.all(
      recipients.map(({ user, isClient }) =>
        this.createAndSendNotification({
          tenantId: ticket.tenantId,
          recipientUserId: user.userId,
          ticketId: ticket.ticketId,
          type: 'TICKET_CREATED',
          title: `New ticket: ${ticket.ticketNumber}`,
          message: isClient
            ? `Your support request "${ticket.ticketTitle}" has been received. We'll be in touch soon.`
            : `A new ticket ${ticket.ticketNumber} — "${ticket.ticketTitle}" has been created.`,
          prefKey: 'emailNewTicket',
          emailTo: user.email,
          emailPayload: {
            recipientName: user.firstName,
            subject: isClient
              ? `Ticket received: ${ticket.ticketNumber}`
              : `New ticket: ${ticket.ticketNumber}`,
            heading: isClient ? 'Your ticket has been received' : `New ticket: ${ticket.ticketNumber}`,
            body: isClient
              ? `We've received your support request: "<strong>${ticket.ticketTitle}</strong>". Our team will review it and get back to you shortly.`
              : `A new support ticket has been created and requires attention.`,
            ticketNumber: ticket.ticketNumber,
            ticketUrl,
            workspaceName: ticket.tenantName,
          },
        }),
      ),
    );
  }

  // ============================================================
  // TRIGGER 2 — TICKET ASSIGNED
  // Recipients: the newly assigned agent
  // ============================================================
  async onTicketAssigned(ticket: TicketContext, assignedAgent: Participant) {
    const ticketUrl = this.buildTicketUrl(ticket.ticketNumber);

    await this.createAndSendNotification({
      tenantId: ticket.tenantId,
      recipientUserId: assignedAgent.userId,
      ticketId: ticket.ticketId,
      type: 'TICKET_ASSIGNED',
      title: `Ticket assigned: ${ticket.ticketNumber}`,
      message: `You've been assigned to ticket ${ticket.ticketNumber} — "${ticket.ticketTitle}".`,
      prefKey: 'emailAssigned',
      emailTo: assignedAgent.email,
      emailPayload: {
        recipientName: assignedAgent.firstName,
        subject: `Ticket assigned to you: ${ticket.ticketNumber}`,
        heading: `You've been assigned a ticket`,
        body: `Ticket <strong>${ticket.ticketNumber}</strong> — "${ticket.ticketTitle}" has been assigned to you. Please review it and take action.`,
        ticketNumber: ticket.ticketNumber,
        ticketUrl,
        workspaceName: ticket.tenantName,
      },
    });
  }

  // ============================================================
  // TRIGGER 3 — NEW COMMENT
  // Recipients: all participants except the comment author
  // ============================================================
  async onNewComment(
    ticket: TicketContext,
    commentAuthorUserId: string,
    commentType: 'PUBLIC' | 'INTERNAL',
    commentPreview: string,
  ) {
    const ticketUrl = this.buildTicketUrl(ticket.ticketNumber);

    // Get all involved users: client (only for public), assigned agent, admins
    const participants = await this.getTicketParticipants(
      ticket.ticketId,
      ticket.tenantId,
      commentType,
    );

    const recipients = participants.filter((p) => p.userId !== commentAuthorUserId);

    await Promise.all(
      recipients.map((user) =>
        this.createAndSendNotification({
          tenantId: ticket.tenantId,
          recipientUserId: user.userId,
          ticketId: ticket.ticketId,
          type: 'NEW_COMMENT',
          title: `New reply on ${ticket.ticketNumber}`,
          message: `${commentPreview.slice(0, 100)}${commentPreview.length > 100 ? '…' : ''}`,
          prefKey: 'emailNewMessage',
          emailTo: user.email,
          emailPayload: {
            recipientName: user.firstName,
            subject: `New reply on ticket ${ticket.ticketNumber}`,
            heading: `New reply on ${ticket.ticketNumber}`,
            body: `A new reply has been posted on ticket "<strong>${ticket.ticketTitle}</strong>".`,
            ticketNumber: ticket.ticketNumber,
            ticketUrl,
            workspaceName: ticket.tenantName,
          },
        }),
      ),
    );
  }

  // ============================================================
  // TRIGGER 4 — STATUS CHANGED
  // Recipients: client + assigned agent + workspace admins
  // ============================================================
  async onStatusChanged(
    ticket: TicketContext,
    fromStatus: string,
    toStatus: string,
    changedByUserId: string,
    client: Participant,
    assignedAgent: Participant | null,
  ) {
    const ticketUrl = this.buildTicketUrl(ticket.ticketNumber);
    const statusLabel = toStatus.replace(/_/g, ' ');
    const fromLabel   = fromStatus.replace(/_/g, ' ');

    const recipients: Participant[] = [client];
    if (assignedAgent && assignedAgent.userId !== changedByUserId) {
      recipients.push(assignedAgent);
    }

    // Also notify all workspace admins who aren't already in the list
    const excludeIds = [changedByUserId, client.userId, assignedAgent?.userId];
    const admins = await this.getWorkspaceAdmins(ticket.tenantId, excludeIds);
    recipients.push(...admins);

    await Promise.all(
      recipients.map((recipient) => {
        const isClient = recipient.userId === client.userId;
        return this.createAndSendNotification({
          tenantId: ticket.tenantId,
          recipientUserId: recipient.userId,
          ticketId: ticket.ticketId,
          type: 'STATUS_CHANGED',
          title: `Ticket ${ticket.ticketNumber} is now ${statusLabel}`,
          message: isClient
            ? `Your ticket "${ticket.ticketTitle}" status changed from ${fromLabel} to ${statusLabel}.`
            : `Ticket ${ticket.ticketNumber} — "${ticket.ticketTitle}" status changed to ${statusLabel}.`,
          prefKey: 'emailStatusChanged',
          emailTo: recipient.email,
          emailPayload: {
            recipientName: recipient.firstName,
            subject: `Ticket ${ticket.ticketNumber} is now ${statusLabel}`,
            heading: `Ticket status updated: ${statusLabel}`,
            body: isClient
              ? `Your support ticket <strong>${ticket.ticketNumber}</strong> — "${ticket.ticketTitle}" has been updated from <strong>${fromLabel}</strong> to <strong>${statusLabel}</strong>.`
              : `Ticket <strong>${ticket.ticketNumber}</strong> — "${ticket.ticketTitle}" status has changed from <strong>${fromLabel}</strong> to <strong>${statusLabel}</strong>.`,
            ticketNumber: ticket.ticketNumber,
            ticketUrl,
            workspaceName: ticket.tenantName,
          },
        });
      }),
    );
  }

  // ============================================================
  // TRIGGER 5 — TICKET CLOSED
  // Recipients: client + workspace admin
  // ============================================================
  async onTicketClosed(
    ticket: TicketContext,
    client: Participant,
    closedByUserId: string,
  ) {
    const ticketUrl = this.buildTicketUrl(ticket.ticketNumber);

    const admins = await this.getWorkspaceAdmins(ticket.tenantId, [closedByUserId]);
    const recipients: { user: Participant; isClient: boolean }[] = [
      { user: client, isClient: true },
      ...admins.map((a) => ({ user: a, isClient: false })),
    ];

    await Promise.all(
      recipients.map(({ user, isClient }) =>
        this.createAndSendNotification({
          tenantId: ticket.tenantId,
          recipientUserId: user.userId,
          ticketId: ticket.ticketId,
          type: 'TICKET_CLOSED',
          title: `Ticket ${ticket.ticketNumber} closed`,
          message: `Ticket "${ticket.ticketTitle}" has been closed.`,
          prefKey: 'emailTicketClosed',
          emailTo: user.email,
          emailPayload: {
            recipientName: user.firstName,
            subject: `Ticket ${ticket.ticketNumber} has been closed`,
            heading: 'Ticket closed',
            body: isClient
              ? `Your support ticket <strong>${ticket.ticketNumber}</strong> — "${ticket.ticketTitle}" has been resolved and closed. If you need further help, you can open a new ticket.`
              : `Ticket <strong>${ticket.ticketNumber}</strong> — "${ticket.ticketTitle}" has been closed.`,
            ticketNumber: ticket.ticketNumber,
            ticketUrl,
            workspaceName: ticket.tenantName,
          },
        }),
      ),
    );
  }

  // ============================================================
  // TRIGGER 6 — BILLING REQUEST CREATED
  // Recipients: the client linked to the ticket
  // ============================================================
  async onBillingRequestCreated(
    ticket: TicketContext,
    client: Participant,
    amount: string,
    currency: string,
    description: string,
  ) {
    const ticketUrl = this.buildTicketUrl(ticket.ticketNumber);

    await this.createAndSendNotification({
      tenantId: ticket.tenantId,
      recipientUserId: client.userId,
      ticketId: ticket.ticketId,
      type: 'BILLING_REQUEST',
      title: `Payment request on ticket ${ticket.ticketNumber}`,
      message: `You have a new payment request of ${currency} ${amount}: "${description}"`,
      prefKey: 'emailBillingRequest',
      emailTo: client.email,
      emailPayload: {
        recipientName: client.firstName,
        subject: `Payment request: ${currency} ${amount} on ticket ${ticket.ticketNumber}`,
        heading: 'New payment request',
        body: `A payment request of <strong>${currency} ${amount}</strong> has been raised on ticket <strong>${ticket.ticketNumber}</strong> — "${ticket.ticketTitle}".<br/><br/>Description: ${description}<br/><br/>Please review and respond.`,
        ticketNumber: ticket.ticketNumber,
        ticketUrl,
        workspaceName: ticket.tenantName,
      },
    });
  }

  // ============================================================
  // TRIGGER 7 — PAYMENT RESPONDED (accepted or declined)
  // Recipients: the staff member who raised the request
  // ============================================================
  async onPaymentResponded(
    ticket: TicketContext,
    requester: Participant,
    accepted: boolean,
    clientName: string,
    declineReason?: string,
  ) {
    const ticketUrl = this.buildTicketUrl(ticket.ticketNumber);
    const action = accepted ? 'accepted' : 'declined';

    await this.createAndSendNotification({
      tenantId: ticket.tenantId,
      recipientUserId: requester.userId,
      ticketId: ticket.ticketId,
      type: accepted ? 'PAYMENT_ACCEPTED' : 'PAYMENT_DECLINED',
      title: `Payment ${action} on ticket ${ticket.ticketNumber}`,
      message: accepted
        ? `${clientName} accepted the payment request.`
        : `${clientName} declined the payment request${declineReason ? `: "${declineReason}"` : ''}.`,
      prefKey: 'emailPaymentUpdate',
      emailTo: requester.email,
      emailPayload: {
        recipientName: requester.firstName,
        subject: `Payment ${action} on ticket ${ticket.ticketNumber}`,
        heading: `Payment request ${action}`,
        body: accepted
          ? `The payment request on ticket <strong>${ticket.ticketNumber}</strong> has been <strong>accepted</strong> by ${clientName}.`
          : `The payment request on ticket <strong>${ticket.ticketNumber}</strong> has been <strong>declined</strong> by ${clientName}${declineReason ? `. Reason: "${declineReason}"` : ''}.`,
        ticketNumber: ticket.ticketNumber,
        ticketUrl,
        workspaceName: ticket.tenantName,
      },
    });
  }

  // ============================================================
  // TRIGGER 8 — BILLING APPROVAL NEEDED
  // Agent created a billing request — notify workspace admins to review it.
  // ============================================================
  async onBillingApprovalNeeded(
    ticket: TicketContext,
    agent: { id: string; firstName: string; lastName: string },
    amount: string,
    currency: string,
    description: string,
  ) {
    const ticketUrl = this.buildTicketUrl(ticket.ticketNumber);
    const admins = await this.getWorkspaceAdmins(ticket.tenantId, [agent.id]);

    await Promise.all(
      admins.map((admin) =>
        this.createAndSendNotification({
          tenantId: ticket.tenantId,
          recipientUserId: admin.userId,
          ticketId: ticket.ticketId,
          type: 'BILLING_APPROVAL_NEEDED',
          title: `Billing request needs your approval — ${ticket.ticketNumber}`,
          message: `${agent.firstName} ${agent.lastName} submitted a payment request of ${currency} ${amount} for review.`,
          prefKey: 'emailBillingRequest',
          emailTo: admin.email,
          emailPayload: {
            recipientName: admin.firstName,
            subject: `Billing request pending approval on ticket ${ticket.ticketNumber}`,
            heading: 'Billing request requires your approval',
            body: `<strong>${agent.firstName} ${agent.lastName}</strong> submitted a payment request of <strong>${currency} ${amount}</strong> on ticket <strong>${ticket.ticketNumber}</strong> — "${ticket.ticketTitle}".<br/><br/>Description: ${description}<br/><br/>Please review and approve or reject it before it is sent to the client.`,
            ticketNumber: ticket.ticketNumber,
            ticketUrl,
            workspaceName: ticket.tenantName,
          },
        }),
      ),
    );
  }

  // ============================================================
  // GET UNREAD NOTIFICATIONS for current user
  // ============================================================
  async getUserNotifications(userId: string, tenantId: string | null, page?: number, limit?: number) {
    const safePage  = Math.max(1, Math.floor(Number(page))  || 1);
    const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(limit)) || 20));
    const skip = (safePage - 1) * safeLimit;

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { recipientUserId: userId, tenantId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.notification.count({ where: { recipientUserId: userId, tenantId } }),
      this.prisma.notification.count({
        where: { recipientUserId: userId, tenantId, isRead: false },
      }),
    ]);

    return { data: notifications, total, unreadCount, page: safePage, limit: safeLimit };
  }

  // ============================================================
  // MARK AS READ
  // ============================================================
  async markAsRead(userId: string, notificationIds: string[]) {
    return this.prisma.notification.updateMany({
      where: { id: { in: notificationIds }, recipientUserId: userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string, tenantId: string | null) {
    return this.prisma.notification.updateMany({
      where: {
        recipientUserId: userId,
        ...(tenantId && { tenantId }),
        isRead: false,
      },
      data: { isRead: true },
    });
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  // ============================================================
  // NOTIFICATION PREFERENCES — GET & UPSERT
  // ============================================================

  /** Returns the preferences record for a user, creating defaults if absent. */
  async getPrefs(userId: string, tenantId: string) {
    const existing = await this.prisma.notificationPreference.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
    });
    if (existing) return existing;

    // Create defaults on first access
    return this.prisma.notificationPreference.create({
      data: { userId, tenantId },
    });
  }

  async upsertPrefs(userId: string, tenantId: string, dto: UpdateNotificationPrefsDto) {
    return this.prisma.notificationPreference.upsert({
      where: { userId_tenantId: { userId, tenantId } },
      create: { userId, tenantId, ...dto },
      update: dto,
    });
  }

  // ============================================================
  // PRIVATE — check if a user wants an email for a given event
  // ============================================================
  private async shouldSendEmail(
    userId: string,
    tenantId: string,
    eventKey: keyof {
      emailNewTicket: boolean;
      emailStatusChanged: boolean;
      emailAssigned: boolean;
      emailNewMessage: boolean;
      emailNewAttachment: boolean;
      emailBillingRequest: boolean;
      emailPaymentUpdate: boolean;
      emailTicketClosed: boolean;
    },
  ): Promise<boolean> {
    try {
      const prefs = await this.prisma.notificationPreference.findUnique({
        where: { userId_tenantId: { userId, tenantId } },
      });
      // No record = all defaults = send
      if (!prefs) return true;
      return prefs[eventKey] as boolean;
    } catch {
      return true; // fail open — always send on error
    }
  }

  private async createAndSendNotification(payload: {
    tenantId: string;
    recipientUserId: string;
    ticketId: string;
    type: string;
    title: string;
    message: string;
    emailTo: string;
    prefKey?: keyof {
      emailNewTicket: boolean;
      emailStatusChanged: boolean;
      emailAssigned: boolean;
      emailNewMessage: boolean;
      emailNewAttachment: boolean;
      emailBillingRequest: boolean;
      emailPaymentUpdate: boolean;
      emailTicketClosed: boolean;
    };
    emailPayload: {
      recipientName: string;
      subject: string;
      heading: string;
      body: string;
      ticketNumber: string;
      ticketUrl: string;
      workspaceName: string;
    };
  }) {
    try {
      // 1. Write in-app notification record (always)
      await this.prisma.notification.create({
        data: {
          tenantId: payload.tenantId,
          recipientUserId: payload.recipientUserId,
          ticketId: payload.ticketId,
          type: payload.type as any,
          title: payload.title,
          message: payload.message,
        },
      });

      // 2. Check user's email preference before sending
      if (payload.prefKey) {
        const allowed = await this.shouldSendEmail(
          payload.recipientUserId,
          payload.tenantId,
          payload.prefKey,
        );
        if (!allowed) return; // in-app notification written, email skipped
      }

      // 3. Fire email — non-blocking, failures logged not thrown
      this.email
        .sendTicketNotification({
          to: payload.emailTo,
          ...payload.emailPayload,
        })
        .then(async () => {
          await this.prisma.notification.updateMany({
            where: {
              recipientUserId: payload.recipientUserId,
              ticketId: payload.ticketId,
              type: payload.type as any,
              emailSent: false,
            },
            data: { emailSent: true, emailSentAt: new Date() },
          });
        })
        .catch((err) =>
          this.logger.error(`Email send failed for ${payload.emailTo}`, err),
        );
    } catch (err) {
      this.logger.error('Failed to create notification record', err);
    }
  }

  /** Get all workspace admins, excluding specified user IDs */
  private async getWorkspaceAdmins(
    tenantId: string,
    excludeIds: (string | null | undefined)[],
  ): Promise<Participant[]> {
    const excluded = excludeIds.filter(Boolean) as string[];

    const members = await this.prisma.tenantMember.findMany({
      where: {
        tenantId,
        role: 'WORKSPACE_ADMIN',
        isActive: true,
        userId: { notIn: excluded },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return members.map((m) => ({
      userId: m.user.id,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      email: m.user.email,
    }));
  }

  /**
   * Get all participants for a ticket (client + assigned agent + admins).
   * For INTERNAL comments, excludes the client.
   */
  private async getTicketParticipants(
    ticketId: string,
    tenantId: string,
    commentType: 'PUBLIC' | 'INTERNAL',
  ): Promise<Participant[]> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        client: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!ticket) return [];

    const participants: Participant[] = [];

    // Client only gets notified for public comments
    if (commentType === 'PUBLIC' && ticket.client.user) {
      participants.push({
        userId: ticket.client.user.id,
        firstName: ticket.client.user.firstName,
        lastName: ticket.client.user.lastName,
        email: ticket.client.user.email,
      });
    }

    // Assigned agent
    if (ticket.assignee) {
      participants.push({
        userId: ticket.assignee.id,
        firstName: ticket.assignee.firstName,
        lastName: ticket.assignee.lastName,
        email: ticket.assignee.email,
      });
    }

    // Workspace admins
    const admins = await this.getWorkspaceAdmins(tenantId, []);
    participants.push(...admins);

    // Deduplicate by userId
    return [...new Map(participants.map((p) => [p.userId, p])).values()];
  }

  private buildTicketUrl(ticketNumber: string): string {
    return `${this.frontendUrl}/tickets/${ticketNumber}`;
  }
}
