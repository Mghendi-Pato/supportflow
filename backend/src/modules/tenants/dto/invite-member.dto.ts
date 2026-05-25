import { IsEmail, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum InvitableMemberRole {
  WORKSPACE_ADMIN = 'WORKSPACE_ADMIN',
  AGENT = 'AGENT',
}

export class InviteMemberDto {
  @ApiProperty({ example: 'agent@acmeagency.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: InvitableMemberRole, example: 'AGENT' })
  @IsEnum(InvitableMemberRole, {
    message: 'Role must be WORKSPACE_ADMIN or AGENT',
  })
  role: InvitableMemberRole;
}
