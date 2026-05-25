import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: ['AGENT', 'WORKSPACE_ADMIN'] })
  @IsIn(['AGENT', 'WORKSPACE_ADMIN'])
  role: 'AGENT' | 'WORKSPACE_ADMIN';
}
