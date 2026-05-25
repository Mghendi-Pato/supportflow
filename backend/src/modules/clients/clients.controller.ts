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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ListClientsDto } from './dto/list-clients.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('Clients')
@ApiBearerAuth()
@UseGuards(TenantGuard, RolesGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  /**
   * POST /clients
   * Create a new client in the workspace. Admin only.
   */
  @Post()
  @Roles('WORKSPACE_ADMIN')
  @ApiOperation({ summary: 'Create a new client' })
  @ApiResponse({ status: 201, description: 'Client created' })
  @ApiResponse({ status: 409, description: 'Email already exists in workspace' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateClientDto) {
    return this.clientsService.create(user.tenantId!, dto);
  }

  /**
   * GET /clients
   * List all clients with pagination and search. Admin + Agent.
   */
  @Get()
  @Roles('WORKSPACE_ADMIN', 'AGENT')
  @ApiOperation({ summary: 'List all clients (paginated)' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: ListClientsDto) {
    return this.clientsService.findAll(user.tenantId!, query);
  }

  /**
   * GET /clients/:id
   * Get a single client's full profile with recent ticket history.
   * Admin + Agent can see all fields. Client sees their own data (no internal notes).
   */
  @Get(':id')
  @Roles('WORKSPACE_ADMIN', 'AGENT', 'CLIENT')
  @ApiOperation({ summary: 'Get a client profile with ticket history' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.clientsService.findOne(user.tenantId!, id, user.role);
  }

  /**
   * PATCH /clients/:id
   * Update client details. Admin only.
   */
  @Patch(':id')
  @Roles('WORKSPACE_ADMIN')
  @ApiOperation({ summary: 'Update a client' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.update(user.tenantId!, id, dto);
  }

  /**
   * DELETE /clients/:id
   * Soft-delete a client. Blocked if they have open tickets.
   */
  @Delete(':id')
  @Roles('WORKSPACE_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a client' })
  @ApiResponse({ status: 400, description: 'Client has open tickets' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.clientsService.remove(user.tenantId!, id);
  }

  /**
   * POST /clients/:id/invite
   * Send the client a portal invitation email so they can log in.
   */
  @Post(':id/invite')
  @Roles('WORKSPACE_ADMIN')
  @ApiOperation({ summary: 'Send portal access invitation to a client' })
  @ApiResponse({ status: 201, description: 'Invitation sent' })
  @ApiResponse({ status: 409, description: 'Client already onboarded or has pending invite' })
  inviteClient(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.clientsService.inviteClient(user.tenantId!, user.sub, id);
  }

  /**
   * POST /clients/:id/invite/resend
   * Resend or refresh an expired client invite.
   */
  @Post(':id/invite/resend')
  @Roles('WORKSPACE_ADMIN')
  @ApiOperation({ summary: 'Resend portal invitation to a client' })
  resendInvite(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.clientsService.resendInvite(user.tenantId!, user.sub, id);
  }
}
