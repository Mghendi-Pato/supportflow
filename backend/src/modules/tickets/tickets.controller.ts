import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ListTicketsDto } from './dto/list-tickets.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class UpdateCommentBody {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  content: string;
}

@ApiTags('Tickets')
@ApiBearerAuth()
@UseGuards(TenantGuard, RolesGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  /**
   * POST /tickets
   * Create a ticket. Clients create for themselves; agents specify clientId.
   */
  @Post()
  @Roles('WORKSPACE_ADMIN', 'AGENT', 'CLIENT')
  @ApiOperation({ summary: 'Create a support ticket' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTicketDto) {
    return this.ticketsService.create(user.tenantId!, user, dto);
  }

  /**
   * GET /tickets
   * List tickets. Clients see only their own; agents/admins see all.
   * Supports filtering by status, priority, clientId, assignedTo, search.
   */
  @Get()
  @Roles('WORKSPACE_ADMIN', 'AGENT', 'CLIENT')
  @ApiOperation({ summary: 'List tickets (role-filtered, paginated)' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: ListTicketsDto) {
    return this.ticketsService.findAll(user.tenantId ?? null, user, query);
  }

  /**
   * GET /tickets/:id
   * Get a single ticket with comments (filtered by role), attachments, activity log.
   * Accepts both UUID and ticket number (e.g. SUP-1042).
   */
  @Get(':id')
  @Roles('WORKSPACE_ADMIN', 'AGENT', 'CLIENT')
  @ApiOperation({ summary: 'Get a ticket by ID or ticket number (e.g. SUP-1042)' })
  @ApiParam({ name: 'id', description: 'Ticket UUID or ticket number (SUP-1042)' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.ticketsService.findOne(user.tenantId ?? null, user, id);
  }

  /**
   * PATCH /tickets/:id
   * Update title, description, or priority. Admin and agent only.
   */
  @Patch(':id')
  @Roles('WORKSPACE_ADMIN', 'AGENT')
  @ApiOperation({ summary: 'Update ticket title, description, or priority' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.ticketsService.update(user.tenantId!, user, id, dto);
  }

  /**
   * PATCH /tickets/:id/status
   * Change ticket status. Triggers notification flow.
   * Optional note is saved as an internal comment.
   */
  @Patch(':id/status')
  @Roles('WORKSPACE_ADMIN', 'AGENT')
  @ApiOperation({ summary: 'Change ticket status (triggers notifications)' })
  changeStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
  ) {
    return this.ticketsService.changeStatus(user.tenantId!, user, id, dto);
  }

  /**
   * PATCH /tickets/:id/assign
   * Assign or unassign a ticket. Send assignedTo: null to unassign.
   */
  @Patch(':id/assign')
  @Roles('WORKSPACE_ADMIN', 'AGENT')
  @ApiOperation({ summary: 'Assign or unassign a ticket to an agent' })
  assign(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AssignTicketDto,
  ) {
    return this.ticketsService.assign(user.tenantId!, user, id, dto);
  }

  /**
   * DELETE /tickets/:id
   * Soft-delete a ticket. Admin only.
   */
  @Delete(':id')
  @Roles('WORKSPACE_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a ticket' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.ticketsService.remove(user.tenantId!, user, id);
  }

  // ============================================================
  // COMMENTS
  // ============================================================

  /**
   * POST /tickets/:id/comments
   * Add a public reply or internal note to a ticket.
   * Clients can only post PUBLIC comments.
   */
  @Post(':id/comments')
  @Roles('WORKSPACE_ADMIN', 'AGENT', 'CLIENT')
  @ApiOperation({ summary: 'Add a comment or internal note to a ticket' })
  addComment(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.ticketsService.addComment(user.tenantId!, user, id, dto);
  }

  /**
   * PATCH /tickets/:id/comments/:commentId
   * Edit a comment. Author or admin only.
   */
  @Patch(':id/comments/:commentId')
  @Roles('WORKSPACE_ADMIN', 'AGENT', 'CLIENT')
  @ApiOperation({ summary: 'Edit a comment (author or admin only)' })
  updateComment(
    @CurrentUser() user: JwtPayload,
    @Param('id') ticketId: string,
    @Param('commentId') commentId: string,
    @Body() body: UpdateCommentBody,
  ) {
    return this.ticketsService.updateComment(user.tenantId!, user, ticketId, commentId, body.content);
  }

  /**
   * DELETE /tickets/:id/comments/:commentId
   * Soft-delete a comment. Author or admin only.
   */
  @Delete(':id/comments/:commentId')
  @Roles('WORKSPACE_ADMIN', 'AGENT', 'CLIENT')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a comment (author or admin only)' })
  deleteComment(
    @CurrentUser() user: JwtPayload,
    @Param('id') ticketId: string,
    @Param('commentId') commentId: string,
  ) {
    return this.ticketsService.deleteComment(user.tenantId!, user, ticketId, commentId);
  }

  // ============================================================
  // ACTIVITY LOG
  // ============================================================

  /**
   * GET /tickets/:id/activity
   * Full audit trail for a ticket — every status change, assignment, comment, etc.
   */
  @Get(':id/activity')
  @Roles('WORKSPACE_ADMIN', 'AGENT', 'CLIENT')
  @ApiOperation({ summary: 'Get the full activity log for a ticket' })
  getActivityLog(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.ticketsService.getActivityLog(user.tenantId!, user, id);
  }
}
