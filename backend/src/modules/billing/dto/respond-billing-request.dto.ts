import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RespondBillingRequestDto {
  @ApiProperty({ description: 'true = accept, false = decline' })
  @IsBoolean()
  accept: boolean;

  @ApiPropertyOptional({ description: 'Required when declining' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  declineReason?: string;
}
