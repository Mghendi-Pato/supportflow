import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class MessageAuthor {
  @Field(() => ID)
  id: string;

  @Field()
  firstName: string;

  @Field()
  lastName: string;

  @Field({ nullable: true })
  avatarUrl?: string;
}

@ObjectType()
export class MessageReceipt {
  @Field(() => ID)
  userId: string;

  @Field()
  status: string; // SENT | DELIVERED | SEEN

  @Field()
  updatedAt: string;
}

@ObjectType()
export class ChatMessage {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  ticketId: string;

  @Field()
  content: string;

  @Field()
  commentType: string; // PUBLIC | INTERNAL

  @Field(() => MessageAuthor)
  author: MessageAuthor;

  @Field(() => [MessageReceipt])
  receipts: MessageReceipt[];

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}

@ObjectType()
export class MessagePage {
  @Field(() => [ChatMessage])
  items: ChatMessage[];

  @Field({ nullable: true })
  nextCursor?: string;

  @Field()
  hasMore: boolean;
}

@ObjectType()
export class ReceiptEvent {
  @Field(() => ID)
  messageId: string;

  @Field(() => ID)
  userId: string;

  @Field()
  status: string;
}

@ObjectType()
export class ChatNotification {
  @Field(() => ID)
  id: string;

  @Field()
  type: string;

  @Field()
  title: string;

  @Field()
  message: string;

  @Field()
  isRead: boolean;

  @Field(() => ID, { nullable: true })
  ticketId?: string;

  @Field()
  createdAt: string;
}
