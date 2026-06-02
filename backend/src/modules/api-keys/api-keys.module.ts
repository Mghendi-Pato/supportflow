import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { ApiKeyStrategy } from './strategies/api-key.strategy';
import { PlanGuard } from '../../common/guards/plan.guard';

@Module({
  imports: [PassportModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysService, ApiKeyStrategy, PlanGuard],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
