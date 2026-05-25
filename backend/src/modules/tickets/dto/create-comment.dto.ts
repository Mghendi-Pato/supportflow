import { IsString, IsEnum, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommentType } from '@prisma/client';

export class CreateCommentDto {
  @ApiProperty({ example: 'We have identified the issue and are working on a fix.' })
  @IsString()
  @MinLength(1)
  content: string;

  @ApiPropertyOptional({
    enum: CommentType,
    default: 'PUBLIC',
    description: 'PUBLIC = client sees this. INTERNAL = staff only.',
  })
  @IsOptional()
  @IsEnum(CommentType)
  commentType?: CommentType = CommentType.PUBLIC;
}
