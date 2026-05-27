import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateNotificationPrefsDto } from '../notifications/dto/update-notification-prefs.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(TenantGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ============================================================
  // PROFILE — any authenticated user
  // ============================================================

  /** GET /users/me — own profile */
  @Get('me')
  @Roles('SUPER_ADMIN', 'WORKSPACE_ADMIN', 'AGENT', 'CLIENT')
  @ApiOperation({ summary: 'Get own profile' })
  getProfile(@CurrentUser() user: JwtPayload) {
    return this.usersService.getProfile(user.sub);
  }

  /** PATCH /users/me — update name */
  @Patch('me')
  @Roles('SUPER_ADMIN', 'WORKSPACE_ADMIN', 'AGENT', 'CLIENT')
  @ApiOperation({ summary: 'Update own profile (name)' })
  updateProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  /** GET /users/me/notification-prefs — get email notification preferences */
  @Get('me/notification-prefs')
  @Roles('SUPER_ADMIN', 'WORKSPACE_ADMIN', 'AGENT', 'CLIENT')
  @ApiOperation({ summary: 'Get own email notification preferences' })
  getNotificationPrefs(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.getPrefs(user.sub, user.tenantId ?? '');
  }

  /** PATCH /users/me/notification-prefs — update email notification preferences */
  @Patch('me/notification-prefs')
  @Roles('SUPER_ADMIN', 'WORKSPACE_ADMIN', 'AGENT', 'CLIENT')
  @ApiOperation({ summary: 'Update own email notification preferences' })
  updateNotificationPrefs(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateNotificationPrefsDto,
  ) {
    return this.notificationsService.upsertPrefs(user.sub, user.tenantId ?? '', dto);
  }

  /** PATCH /users/me/password — change password (revokes all sessions) */
  @Patch('me/password')
  @Roles('SUPER_ADMIN', 'WORKSPACE_ADMIN', 'AGENT', 'CLIENT')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password (revokes all active sessions)' })
  changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(user.sub, dto);
  }

  // ============================================================
  // WORKSPACE — members list (for ticket assignment dropdowns, etc.)
  // ============================================================

  /** GET /users/workspace-members — agents + admins in the workspace */
  @Get('workspace-members')
  @Roles('WORKSPACE_ADMIN', 'AGENT')
  @ApiOperation({ summary: 'List all workspace members (for assignment dropdowns)' })
  getWorkspaceMembers(@CurrentUser() user: JwtPayload) {
    return this.usersService.getWorkspaceMembers(user.tenantId!);
  }

  // ============================================================
  // SUPER ADMIN — platform management
  // ============================================================

  /** GET /users — all platform users (super admin only) */
  @Get()
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: '[Super Admin] List all platform users' })
  getAllUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.usersService.getAllUsers(page ? Number(page) : 1, limit ? Number(limit) : 20, search);
  }

  /** DELETE /users/:id — soft-delete a user with email obfuscation (super admin only) */
  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Super Admin] Soft-delete a user (obfuscates email to prevent re-registration conflicts)' })
  softDeleteUser(@CurrentUser() user: JwtPayload, @Param('id') targetId: string) {
    return this.usersService.softDeleteUser(user.sub, targetId);
  }

  /** GET /users/tenants — all workspaces (super admin only) */
  @Get('tenants')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: '[Super Admin] List all workspaces' })
  getAllTenants(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.usersService.getAllTenants(page ? Number(page) : 1, limit ? Number(limit) : 20);
  }

  /** PATCH /users/tenants/:id/suspend — suspend a workspace */
  @Patch('tenants/:id/suspend')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: '[Super Admin] Suspend a workspace' })
  suspendTenant(@Param('id') tenantId: string) {
    return this.usersService.setTenantActiveStatus(tenantId, false);
  }

  /** PATCH /users/tenants/:id/reinstate — reinstate a workspace */
  @Patch('tenants/:id/reinstate')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: '[Super Admin] Reinstate a suspended workspace' })
  reinstateTenant(@Param('id') tenantId: string) {
    return this.usersService.setTenantActiveStatus(tenantId, true);
  }
}
