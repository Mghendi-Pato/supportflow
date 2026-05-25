import { IsString, IsEnum, IsOptional, IsUUID, MinLength, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TicketPriority } from '@prisma/client';

export class UpdateTicketDto {
  @ApiPropertyOptional({ example: 'Updated: Receipt printer issue after v2.1.4 update' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(10)
  description?: string;

  @ApiPropertyOptional({ enum: TicketPriority })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;
}
