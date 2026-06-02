import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenantPlan } from '@prisma/client';

export class PreRegisterDto {
  @ApiProperty({ example: 'patrick@acmeagency.com' })
  @IsEmail({}, { message: 'Enter a valid email address' })
  email: string;

  @ApiPropertyOptional({ enum: TenantPlan, example: 'FREE' })
  @IsOptional()
  @IsEnum(TenantPlan)
  plan?: TenantPlan;
}
