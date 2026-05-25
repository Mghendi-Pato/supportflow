import {
  Controller, Post, Get, Patch,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { CreateBillingRequestDto } from './dto/create-billing-request.dto';
import { RespondBillingRequestDto } from './dto/respond-billing-request.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(TenantGuard, RolesGuard)
@Controller('billing-requests')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  /**
   * POST /billing-requests
   * Staff creates a payment request.
   * Admins → PENDING (client notified immediately).
   * Agents → AWAITING_APPROVAL (admin must approve first).
   */
  @Post()
  @Roles('WORKSPACE_ADMIN', 'AGENT')
  @ApiOperation({ summary: 'Create a billing request for a client' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateBillingRequestDto) {
    return this.billingService.create(user.tenantId!, user, dto);
  }

  /**
   * PATCH /billing-requests/:id/approve
   * Admin approves an AWAITING_APPROVAL request → moves it to PENDING so
   * the client can see and respond to it.
   */
  @Patch(':id/approve')
  @Roles('WORKSPACE_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Approve a pending-review billing request (admin only)' })
  approve(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.billingService.approve(id, user);
  }

  /**
   * GET /billing-requests?ticketId=xxx
   * List billing requests for a ticket.
   * Clients only see PENDING / ACCEPTED / DECLINED (not AWAITING_APPROVAL).
   */
  @Get()
  @Roles('WORKSPACE_ADMIN', 'AGENT', 'CLIENT')
  @ApiOperation({ summary: 'List billing requests for a ticket' })
  @ApiQuery({ name: 'ticketId', required: true })
  getForTicket(
    @CurrentUser() user: JwtPayload,
    @Query('ticketId') ticketId: string,
  ) {
    return this.billingService.getForTicket(user.tenantId!, ticketId, user);
  }

  /**
   * PATCH /billing-requests/:id/respond
   * Client accepts or declines a billing request (PENDING only).
   */
  @Patch(':id/respond')
  @Roles('CLIENT')
  @ApiOperation({ summary: 'Accept or decline a billing request (client only)' })
  respond(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RespondBillingRequestDto,
  ) {
    return this.billingService.respond(id, user, dto);
  }

  /**
   * GET /billing-requests/spending
   * Client's spending summary — all accepted billing requests in a date range.
   */
  @Get('spending')
  @Roles('CLIENT')
  @ApiOperation({ summary: 'Get spending summary for the logged-in client' })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date string' })
  @ApiQuery({ name: 'to',   required: false, description: 'ISO date string' })
  getSpending(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to')   to?: string,
  ) {
    return this.billingService.getSpendingSummary(user.tenantId!, user, from, to);
  }
}
