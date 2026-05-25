import { IsUUID, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AssignTicketDto {
  @ApiPropertyOptional({
    description: 'Agent user ID to assign. Send null to unassign.',
    example: 'uuid-of-agent',
  })
  @IsOptional()
  @IsUUID()
  assignedTo?: string | null;
}
