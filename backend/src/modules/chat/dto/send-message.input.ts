import { InputType, Field, ID } from '@nestjs/graphql';
import { IsIn, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

@InputType()
export class SendMessageInput {
  @Field(() => ID)
  @IsUUID()
  ticketId: string;

  @Field()
  @IsNotEmpty()
  content: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsIn(['PUBLIC', 'INTERNAL'])
  commentType?: string;
}
