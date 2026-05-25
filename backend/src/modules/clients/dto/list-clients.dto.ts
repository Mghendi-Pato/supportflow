import { IsOptional, IsString, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListClientsDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'acme', description: 'Search by name, company, or email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: true, description: 'Filter by active status' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}
