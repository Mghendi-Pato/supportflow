import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
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

  @ApiProperty({ example: 'patrick@acmeagency.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt limit
  password: string;

  @ApiProperty({ example: 'Acme Agency' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  workspaceName: string;

  @ApiProperty({ example: 'acme-agency', description: 'URL-safe slug for the workspace' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase letters, numbers, and hyphens only (e.g. acme-agency)',
  })
  workspaceSlug: string;
}
