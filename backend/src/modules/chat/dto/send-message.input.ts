import { InputType, Field, ID } from '@nestjs/graphql';
import { IsArray, IsIn, IsOptional, IsUUID, ValidateIf } from 'class-validator';

@InputType()
export class SendMessageInput {
  @Field(() => ID)
  @IsUUID()
  ticketId: string;

  // Content is optional when attachments are present
  @Field({ nullable: true })
  @IsOptional()
  content?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsIn(['PUBLIC', 'INTERNAL'])
  commentType?: string;

  // IDs of attachments already uploaded via REST /uploads/tickets/:id
  @Field(() => [ID], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  attachmentIds?: string[];
}
