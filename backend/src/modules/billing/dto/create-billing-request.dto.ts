import { IsUUID, IsNumber, IsPositive, IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateBillingRequestDto {
  @ApiProperty({ description: 'Ticket ID this request is for' })
  @IsUUID()
  ticketId: string;

  @ApiProperty({ example: 5000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ example: 'KES', default: 'KES' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string = 'KES';

  @ApiProperty({ example: 'Integration setup fee for Branch 2 POS system' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;
}
