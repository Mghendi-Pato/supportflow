import { IsEmail, IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClientDto {
  @ApiProperty({ example: 'Patrick Mwamburi' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  contactName: string;

  @ApiProperty({ example: 'client@company.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'Acme POS Solutions' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string;

  @ApiPropertyOptional({ example: '+254712345678' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ example: 'Enterprise client — POS system for 3 branches' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
