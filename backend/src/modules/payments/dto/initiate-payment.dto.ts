import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TenantPlan } from '@prisma/client';

export class InitiatePaymentDto {
  @ApiProperty({ enum: ['STANDARD', 'PREMIUM'], example: 'STANDARD' })
  @IsEnum(['STANDARD', 'PREMIUM'], { message: 'Plan must be STANDARD or PREMIUM' })
  plan: Extract<TenantPlan, 'STANDARD' | 'PREMIUM'>;
}
