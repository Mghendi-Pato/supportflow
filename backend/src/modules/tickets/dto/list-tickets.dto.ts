import { IsOptional, IsEnum, IsString, IsUUID, IsInt, Min, Max, IsDateString } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TicketStatus, TicketPriority } from '@prisma/client';

export class ListTicketsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  /**
   * Filter by a single status.
   * If `statuses` is also provided, `statuses` takes precedence.
   */
  @ApiPropertyOptional({ enum: TicketStatus })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  /**
   * Filter by multiple statuses — comma-separated string, e.g. "OPEN,IN_PROGRESS,WAITING".
   * Takes precedence over `status` when both are supplied.
   */
  @ApiPropertyOptional({ description: 'Comma-separated statuses, e.g. OPEN,IN_PROGRESS,WAITING' })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value;
    return String(value).split(',').map((s) => s.trim()).filter(Boolean);
  })
  @IsEnum(TicketStatus, { each: true })
  statuses?: TicketStatus[];

  @ApiPropertyOptional({ enum: TicketPriority })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiPropertyOptional({ description: 'Filter by client ID' })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Filter by assigned agent user ID' })
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @ApiPropertyOptional({ description: 'Search by ticket number, title, or description' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Sort field', enum: ['createdAt', 'updatedAt', 'priority', 'status'] })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ description: 'Filter tickets created on or after this date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Filter tickets created on or before this date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
