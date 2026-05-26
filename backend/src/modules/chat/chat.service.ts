import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SendMessageInput } from './dto/send-message.input';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // GET MESSAGES — paginated, cursor-based
  // ============================================================
  async getMessages(
    ticketId: string,
    userId: string,
    role: string,
    cursor?: string,
    limit = 30,
  ) {
    // Verify access
    await this.assertTicketAccess(ticketId, userId, role);

    const take = Math.min(limit, 50);
    const comments = await this.prisma.ticketComment.findMany({
      where: {
        ticketId,
        deletedAt: null,
        // Clients only see PUBLIC comments
        ...(role === 'CLIENT' ? { commentType: 'PUBLIC' } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: take + 1, // fetch one extra to detect hasMore
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        receipts: { select: { userId: true, status: true, updatedAt: true } },
        attachments: {
          select: { id: true, fileName: true, fileUrl: true, mimeType: true, fileSizeBytes: true },
        },
      },
    });

    const hasMore = comments.length > take;
    const items = hasMore ? comments.slice(0, take) : comments;
    const nextCursor = hasMore ? items[items.length - 1].id : undefined;

    return {
      items: items.map(this.formatMessage),
      nextCursor,
      hasMore,
    };
  }

  // ============================================================
  // SEND MESSAGE — create comment + receipts for all participants
  // ============================================================
  async sendMessage(input: SendMessageInput, userId: string, role: string) {
    const ticket = await this.assertTicketAccess(input.ticketId, userId, role);

    // Clients can only send PUBLIC comments
    const commentType =
      role === 'CLIENT' ? 'PUBLIC' : (input.commentType ?? 'PUBLIC');

    // Validate: must have content OR attachments
    const hasContent = input.content && input.content.trim().length > 0;
    const hasAttachments = input.attachmentIds && input.attachmentIds.length > 0;
    if (!hasContent && !hasAttachments) {
      throw new Error('Message must have content or at least one attachment');
    }

    const comment = await this.prisma.ticketComment.create({
      data: {
        tenantId: ticket.tenantId,
        ticketId: input.ticketId,
        authorUserId: userId,
        content: input.content?.trim() || '',
        commentType: commentType as any,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        receipts: { select: { userId: true, status: true, updatedAt: true } },
        attachments: {
          select: { id: true, fileName: true, fileUrl: true, mimeType: true, fileSizeBytes: true },
        },
      },
    });

    // Link uploaded attachments to this comment
    if (hasAttachments) {
      await this.prisma.ticketAttachment.updateMany({
        where: {
          id: { in: input.attachmentIds },
          ticketId: input.ticketId,   // security: only attachments on this ticket
          commentId: null,            // only unlinked attachments
        },
        data: { commentId: comment.id },
      });
    }

    // Create SENT receipt for the author (their own message)
    await this.upsertReceipt(comment.id, userId, 'SENT');

    // Create SENT receipts for all other participants
    const participantIds = await this.getTicketParticipantIds(
      input.ticketId,
      ticket.tenantId,
      commentType === 'PUBLIC',
    );

    const otherParticipants = participantIds.filter((id) => id !== userId);
    if (otherParticipants.length) {
      await this.prisma.messageReceipt.createMany({
        data: otherParticipants.map((pid) => ({
          commentId: comment.id,
          userId: pid,
          status: 'SENT' as any,
        })),
        skipDuplicates: true,
      });
    }

    // Re-fetch with fresh receipts + linked attachments
    const withReceipts = await this.prisma.ticketComment.findUnique({
      where: { id: comment.id },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        receipts: { select: { userId: true, status: true, updatedAt: true } },
        attachments: {
          select: { id: true, fileName: true, fileUrl: true, mimeType: true, fileSizeBytes: true },
        },
      },
    });

    return this.formatMessage(withReceipts!);
  }

  // ============================================================
  // MARK DELIVERED — call when user opens the ticket (SENT → DELIVERED)
  // ============================================================
  async markDelivered(ticketId: string, userId: string) {
    // Find all SENT receipts for this user in this ticket
    const receipts = await this.prisma.messageReceipt.findMany({
      where: {
        status: 'SENT',
        userId,
        comment: { ticketId },
      },
      select: { id: true, commentId: true },
    });

    if (!receipts.length) return [];

    await this.prisma.messageReceipt.updateMany({
      where: { id: { in: receipts.map((r) => r.id) } },
      data: { status: 'DELIVERED' },
    });

    return receipts.map((r) => ({ messageId: r.commentId, userId, status: 'DELIVERED' }));
  }

  // ============================================================
  // MARK SEEN — call when user reads/views specific messages
  // ============================================================
  async markSeen(messageIds: string[], userId: string) {
    await this.prisma.messageReceipt.updateMany({
      where: {
        commentId: { in: messageIds },
        userId,
        status: { in: ['SENT', 'DELIVERED'] },
      },
      data: { status: 'SEEN' },
    });

    return messageIds.map((id) => ({ messageId: id, userId, status: 'SEEN' }));
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private formatMessage(comment: any) {
    return {
      id: comment.id,
      ticketId: comment.ticketId,
      content: comment.content,
      commentType: comment.commentType,
      author: {
        id: comment.author.id,
        firstName: comment.author.firstName,
        lastName: comment.author.lastName,
        avatarUrl: comment.author.avatarUrl ?? null,
      },
      receipts: (comment.receipts ?? []).map((r: any) => ({
        userId: r.userId,
        status: r.status,
        updatedAt: r.updatedAt.toISOString(),
      })),
      attachments: (comment.attachments ?? []).map((a: any) => ({
        id: a.id,
        fileName: a.fileName,
        fileUrl: a.fileUrl,
        mimeType: a.mimeType,
        fileSizeBytes: a.fileSizeBytes,
      })),
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
    };
  }

  private async assertTicketAccess(ticketId: string, userId: string, role: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, deletedAt: null },
      include: {
        client: { select: { userId: true } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    // Clients may only access their own tickets
    if (role === 'CLIENT' && ticket.client.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return ticket;
  }

  private async getTicketParticipantIds(
    ticketId: string,
    tenantId: string,
    includeClient: boolean,
  ): Promise<string[]> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        client: { select: { userId: true } },
        assignee: { select: { id: true } },
      },
    });
    if (!ticket) return [];

    const ids = new Set<string>();

    if (includeClient && ticket.client.userId) {
      ids.add(ticket.client.userId);
    }
    if (ticket.assignee) ids.add(ticket.assignee.id);

    // Add all workspace admins
    const admins = await this.prisma.tenantMember.findMany({
      where: { tenantId, role: 'WORKSPACE_ADMIN', isActive: true },
      select: { userId: true },
    });
    admins.forEach((a) => ids.add(a.userId));

    return [...ids];
  }

  private async upsertReceipt(commentId: string, userId: string, status: string) {
    await this.prisma.messageReceipt.upsert({
      where: { commentId_userId: { commentId, userId } },
      create: { commentId, userId, status: status as any },
      update: { status: status as any },
    });
  }
}
