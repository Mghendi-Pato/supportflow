import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPass123!' })
  @IsString()
  @MinLength(8)
  currentPassword: string;

  @ApiProperty({ example: 'NewSecurePass456!' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;
}
