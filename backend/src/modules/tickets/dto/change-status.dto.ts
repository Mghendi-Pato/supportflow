import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketStatus } from '@prisma/client';

export class ChangeStatusDto {
  @ApiProperty({ enum: TicketStatus, example: 'IN_PROGRESS' })
  @IsEnum(TicketStatus)
  status: TicketStatus;

  @ApiPropertyOptional({ example: 'Identified the issue — rolling out fix now' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string; // Optional internal note logged alongside the status change
}
