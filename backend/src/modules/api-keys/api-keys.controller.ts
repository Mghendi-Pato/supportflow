import {
  Controller, Get, Post, Delete, Body, Param,
  HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PlanGuard, RequiresPlan } from '../../common/guards/plan.guard';

@Controller('api-keys')
@UseGuards(PlanGuard)
@RequiresPlan('PREMIUM')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  /** POST /api-keys — generate a new key */
  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateApiKeyDto) {
    return this.apiKeysService.create(user.tenantId!, dto);
  }

  /** GET /api-keys — list all active keys */
  @Get()
  async list(@CurrentUser() user: JwtPayload) {
    return this.apiKeysService.list(user.tenantId!);
  }

  /** DELETE /api-keys/:id — revoke a key */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async revoke(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.apiKeysService.revoke(user.tenantId!, id);
  }
}
