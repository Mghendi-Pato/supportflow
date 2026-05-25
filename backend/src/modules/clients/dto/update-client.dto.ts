import { IsEmail, IsString, IsOptional, IsBoolean, MinLength, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateClientDto {
  @ApiPropertyOptional({ example: 'Patrick Mwamburi' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  contactName?: string;

  @ApiPropertyOptional({ example: 'new@company.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Acme POS Solutions Ltd' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string;

  @ApiPropertyOptional({ example: '+254712345678' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ example: 'Updated internal notes' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
