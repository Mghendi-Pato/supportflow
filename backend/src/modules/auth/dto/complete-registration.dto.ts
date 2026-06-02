import {
  IsEmail,
  IsEnum,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TenantPlan } from '@prisma/client';

export class CompleteRegistrationDto {
  /** Verification token from the email link */
  @ApiProperty({ example: 'abc123...' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'Patrick' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Mwamburi' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @ApiProperty({ example: 'Acme Agency' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  workspaceName: string;

  @ApiProperty({ example: 'acme-agency' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase letters, numbers, and hyphens only (e.g. acme-agency)',
  })
  workspaceSlug: string;

  @ApiProperty({ enum: TenantPlan, example: 'FREE' })
  @IsEnum(TenantPlan, { message: 'Plan must be FREE, STANDARD, or PREMIUM' })
  plan: TenantPlan;
}
