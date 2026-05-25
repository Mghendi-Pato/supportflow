import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AcceptInviteDto {
  @ApiProperty({ description: 'The invite token from the email link' })
  @IsString()
  @IsNotEmpty()
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
}
