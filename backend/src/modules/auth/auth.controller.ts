import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from './strategies/jwt.strategy';

@ApiTags('Auth')
@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/register
   * Creates a new user account + workspace. Returns tokens.
   */
  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new workspace (freelancer / agency)' })
  @ApiResponse({ status: 201, description: 'Registration successful' })
  @ApiResponse({ status: 409, description: 'Email or slug already taken' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * POST /auth/login
   * Authenticates a user and returns access + refresh tokens.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * POST /auth/refresh
   * Issues a new access token using a valid refresh token.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'New tokens issued' })
  @ApiResponse({ status: 401, description: 'Refresh token invalid or expired' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  /**
   * POST /auth/logout
   * Revokes the stored refresh token (requires valid access token).
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  logout(@CurrentUser('sub') userId: string) {
    return this.authService.logout(userId);
  }

  /**
   * POST /auth/invite/accept
   * Completes onboarding for an invited agent or client.
   */
  @Public()
  @Post('invite/accept')
  @ApiOperation({ summary: 'Accept a workspace invitation and create account' })
  @ApiResponse({ status: 201, description: 'Account created and logged in' })
  @ApiResponse({ status: 400, description: 'Invite expired or already used' })
  @ApiResponse({ status: 404, description: 'Invite token not found' })
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.authService.acceptInvite(dto);
  }

  /**
   * GET /auth/me
   * Returns the currently authenticated user's profile + role + tenant.
   */
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user data' })
  getMe(@CurrentUser() user: JwtPayload) {
    return this.authService.getMe(user.sub);
  }
}
