import { IsString, IsOptional, MinLength, MaxLength, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTenantDto {
  @ApiPropertyOptional({ example: 'Acme Agency Ltd' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/...' })
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Arbitrary workspace settings as JSON' })
  @IsOptional()
  settings?: Record<string, unknown>;
}
