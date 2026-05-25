import { IsString, IsEnum, IsOptional, IsUUID, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketPriority } from '@prisma/client';

export class CreateTicketDto {
  @ApiProperty({ example: 'Receipt printer not working after update' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  title: string;

  @ApiProperty({ example: 'After updating to v2.1.4, the receipt printer stops responding...' })
  @IsString()
  @MinLength(10)
  description: string;

  @ApiPropertyOptional({
    description: 'Required when an agent creates a ticket on behalf of a client',
    example: 'uuid-of-client',
  })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({ enum: TicketPriority, default: 'MEDIUM' })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority = TicketPriority.MEDIUM;

  @ApiPropertyOptional({ description: 'Agent user ID to assign immediately', example: 'uuid-of-agent' })
  @IsOptional()
  @IsUUID()
  assignedTo?: string;
}
