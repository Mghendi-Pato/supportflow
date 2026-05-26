import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('Workspace (Tenant)')
@ApiBearerAuth()
@UseGuards(TenantGuard, RolesGuard)
@Controller('workspace')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  /**
   * GET /workspace/all
   * SUPER_ADMIN only — list every workspace on the platform for the workspace picker.
   */
  @Get('all')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'List all workspaces (super admin only)' })
  listAllWorkspaces() {
    return this.tenantsService.listAllTenants();
  }

  /**
   * GET /workspace
   * Returns the current user's workspace profile.
   */
  @Get()
  @ApiOperation({ summary: 'Get current workspace details' })
  getMyTenant(@CurrentUser() user: JwtPayload) {
    return this.tenantsService.getMyTenant(user.tenantId!);
  }

  /**
   * PATCH /workspace
   * Update workspace name, logo, or settings. Admin only.
   */
  @Patch()
  @Roles('WORKSPACE_ADMIN')
  @ApiOperation({ summary: 'Update workspace settings' })
  updateTenant(@CurrentUser() user: JwtPayload, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.updateTenant(user.tenantId!, dto);
  }

  /**
   * GET /workspace/members
   * List all active workspace admins and agents.
   */
  @Get('members')
  @Roles('WORKSPACE_ADMIN', 'AGENT')
  @ApiOperation({ summary: 'List all workspace members' })
  getMembers(@CurrentUser() user: JwtPayload) {
    return this.tenantsService.getMembers(user.tenantId!);
  }

  /**
   * POST /workspace/members/invite
   * Invite a new agent or workspace admin. Admin only.
   */
  @Post('members/invite')
  @Roles('WORKSPACE_ADMIN')
  @ApiOperation({ summary: 'Invite an agent or admin to the workspace' })
  @ApiResponse({ status: 201, description: 'Invitation sent' })
  @ApiResponse({ status: 409, description: 'Already a member or pending invite exists' })
  inviteMember(@CurrentUser() user: JwtPayload, @Body() dto: InviteMemberDto) {
    return this.tenantsService.inviteMember(user.tenantId!, user.sub, dto);
  }

  /**
   * PATCH /workspace/members/:userId/role
   * Change a member's role between AGENT and WORKSPACE_ADMIN. Admin only.
   */
  @Patch('members/:userId/role')
  @Roles('WORKSPACE_ADMIN')
  @ApiOperation({ summary: 'Change a member role (AGENT ↔ WORKSPACE_ADMIN)' })
  updateMemberRole(
    @CurrentUser() user: JwtPayload,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.tenantsService.updateMemberRole(user.tenantId!, user.sub, targetUserId, dto.role);
  }

  /**
   * DELETE /workspace/members/:userId
   * Remove a team member from the workspace. Admin only.
   */
  @Delete('members/:userId')
  @Roles('WORKSPACE_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a member from the workspace' })
  removeMember(@CurrentUser() user: JwtPayload, @Param('userId') targetUserId: string) {
    return this.tenantsService.removeMember(user.tenantId!, user.sub, targetUserId);
  }

  /**
   * GET /workspace/invitations
   * List all pending (not yet accepted) member invitations.
   */
  @Get('invitations')
  @Roles('WORKSPACE_ADMIN')
  @ApiOperation({ summary: 'List pending member invitations' })
  getPendingInvitations(@CurrentUser() user: JwtPayload) {
    return this.tenantsService.getPendingInvitations(user.tenantId!);
  }

  /**
   * DELETE /workspace/invitations/:invitationId
   * Revoke a pending invitation before it is accepted.
   */
  @Delete('invitations/:invitationId')
  @Roles('WORKSPACE_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a pending invitation' })
  revokeInvitation(
    @CurrentUser() user: JwtPayload,
    @Param('invitationId') invitationId: string,
  ) {
    return this.tenantsService.revokeInvitation(user.tenantId!, invitationId);
  }
}
