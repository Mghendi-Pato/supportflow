import {
  Resolver,
  Query,
  Mutation,
  Subscription,
  Args,
  ID,
  Int,
  Context,
} from '@nestjs/graphql';
import { Inject, UseGuards } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { ChatService } from './chat.service';
import { PUB_SUB } from './pubsub.provider';
import { SendMessageInput } from './dto/send-message.input';
import {
  ChatMessage,
  MessagePage,
  ReceiptEvent,
  ChatNotification,
} from './models/message.model';
import { GqlAuthGuard } from './guards/gql-auth.guard';

// PubSub event keys
export const MESSAGE_SENT = 'MESSAGE_SENT';
export const RECEIPT_UPDATED = 'RECEIPT_UPDATED';
export const NOTIFICATION_ADDED = 'NOTIFICATION_ADDED';

@Resolver()
export class ChatResolver {
  constructor(
    private readonly chatService: ChatService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  // ── Queries ────────────────────────────────────────────────────────────────

  @Query(() => MessagePage)
  @UseGuards(GqlAuthGuard)
  async messages(
    @Args('ticketId', { type: () => ID }) ticketId: string,
    @Args('cursor', { type: () => String, nullable: true }) cursor: string | undefined,
    @Args('limit', { type: () => Int, nullable: true }) limit: number | undefined,
    @Context() ctx: any,
  ): Promise<MessagePage> {
    const { userId, role } = ctx.user;
    return this.chatService.getMessages(ticketId, userId, role, cursor, limit);
  }

  // ── Mutations ──────────────────────────────────────────────────────────────

  @Mutation(() => ChatMessage)
  @UseGuards(GqlAuthGuard)
  async sendMessage(
    @Args('input') input: SendMessageInput,
    @Context() ctx: any,
  ): Promise<ChatMessage> {
    const { userId, role } = ctx.user;
    const message = await this.chatService.sendMessage(input, userId, role);

    // Broadcast to all subscribers on this ticket
    this.pubSub.publish(`${MESSAGE_SENT}_${input.ticketId}`, {
      messageSent: message,
    });

    return message;
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async markDelivered(
    @Args('ticketId', { type: () => ID }) ticketId: string,
    @Context() ctx: any,
  ): Promise<boolean> {
    const { userId } = ctx.user;
    const events = await this.chatService.markDelivered(ticketId, userId);

    if (events.length) {
      this.pubSub.publish(`${RECEIPT_UPDATED}_${ticketId}`, {
        receiptUpdated: events,
      });
    }
    return true;
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async markSeen(
    @Args('ticketId', { type: () => ID }) ticketId: string,
    @Args('messageIds', { type: () => [ID] }) messageIds: string[],
    @Context() ctx: any,
  ): Promise<boolean> {
    const { userId } = ctx.user;
    const events = await this.chatService.markSeen(messageIds, userId);

    if (events.length) {
      this.pubSub.publish(`${RECEIPT_UPDATED}_${ticketId}`, {
        receiptUpdated: events,
      });
    }
    return true;
  }

  // ── Subscriptions ──────────────────────────────────────────────────────────

  @Subscription(() => ChatMessage, {
    filter: (payload, variables) =>
      payload.messageSent.ticketId === variables.ticketId,
  })
  messageSent(@Args('ticketId', { type: () => ID }) ticketId: string) {
    return this.pubSub.asyncIterator(`${MESSAGE_SENT}_${ticketId}`);
  }

  @Subscription(() => [ReceiptEvent], {
    resolve: (payload) => payload.receiptUpdated,
  })
  receiptUpdated(@Args('ticketId', { type: () => ID }) ticketId: string) {
    return this.pubSub.asyncIterator(`${RECEIPT_UPDATED}_${ticketId}`);
  }

  @Subscription(() => ChatNotification, {
    filter: (payload, _variables, context) =>
      payload.notificationAdded.recipientUserId === context.userId,
    resolve: (payload) => payload.notificationAdded,
  })
  notificationAdded() {
    return this.pubSub.asyncIterator(NOTIFICATION_ADDED);
  }
}

// Helper — call from NotificationsService to push real-time notifications
export function publishNotification(pubSub: PubSub, notification: any) {
  pubSub.publish(NOTIFICATION_ADDED, { notificationAdded: notification });
}
