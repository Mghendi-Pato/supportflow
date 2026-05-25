import { Controller, Get, Patch, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class MarkReadDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  notificationIds: string[];
}

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /** GET /notifications — paginated list for current user */
  @Get()
  @ApiOperation({ summary: 'Get notifications for current user' })
  getNotifications(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.notificationsService.getUserNotifications(
      user.sub,
      user.tenantId!,
      page,
      limit,
    );
  }

  /** PATCH /notifications/read — mark specific notifications as read */
  @Patch('read')
  @ApiOperation({ summary: 'Mark notifications as read' })
  markAsRead(@CurrentUser() user: JwtPayload, @Body() dto: MarkReadDto) {
    return this.notificationsService.markAsRead(user.sub, dto.notificationIds);
  }

  /** PATCH /notifications/read-all — mark all unread as read */
  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllAsRead(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.markAllAsRead(user.sub, user.tenantId!);
  }
}
