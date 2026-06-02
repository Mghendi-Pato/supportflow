import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { PreRegisterDto } from './dto/pre-register.dto';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from './strategies/jwt.strategy';

@ApiTags('Auth')
@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  private readonly frontendUrl: string;

  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = config.get<string>('FRONTEND_URL') || 'http://localhost:3001';
  }

  /**
   * POST /auth/pre-register
   * Step 1: sends a verification email so the user can confirm their address.
   */
  @Public()
  @Post('pre-register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start email-first registration — sends a verification link' })
  @ApiResponse({ status: 200, description: 'Verification email sent (or silently swallowed if email is taken)' })
  preRegister(@Body() dto: PreRegisterDto) {
    return this.authService.preRegister(dto);
  }

  /**
   * GET /auth/verify-registration/:token
   * Validates a registration token; returns the email for pre-filling the form.
   */
  @Public()
  @Get('verify-registration/:token')
  @ApiOperation({ summary: 'Validate a registration verification token' })
  @ApiResponse({ status: 200, description: 'Token valid — returns email' })
  @ApiResponse({ status: 400, description: 'Token invalid or expired' })
  verifyRegistrationToken(@Param('token') token: string) {
    return this.authService.verifyRegistrationToken(token);
  }

  /**
   * POST /auth/register/complete
   * Step 2: completes registration — validates token, creates account + workspace.
   */
  @Public()
  @Post('register/complete')
  @ApiOperation({ summary: 'Complete registration after email verification' })
  @ApiResponse({ status: 201, description: 'Account created' })
  @ApiResponse({ status: 400, description: 'Token invalid or expired' })
  @ApiResponse({ status: 409, description: 'Email or slug already taken' })
  completeRegistration(@Body() dto: CompleteRegistrationDto) {
    return this.authService.completeRegistration(dto);
  }

  /**
   * POST /auth/register
   * Legacy direct registration — kept for Google OAuth workspace creation.
   */
  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new workspace (Google OAuth flow / legacy)' })
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
   * POST /auth/forgot-password
   * Sends a password-reset email if the account exists.
   */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiResponse({ status: 200, description: 'Reset email sent (or silently ignored if email not found)' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  /**
   * POST /auth/reset-password
   * Validates the reset token and sets a new password.
   */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using a valid token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Token invalid or expired' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  /**
   * GET /auth/google
   * Redirects the browser to Google's OAuth consent screen.
   */
  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin(@Res() res: Response) {
    // If GOOGLE_CLIENT_ID isn't configured, Passport will error before here.
    // The placeholder value prevents a crash on boot; real credentials are
    // required for this route to actually work.
    if (this.config.get('GOOGLE_CLIENT_ID') === 'GOOGLE_CLIENT_ID_NOT_SET' ||
        !this.config.get('GOOGLE_CLIENT_ID')) {
      return (res as any).redirect(`${this.frontendUrl}/login?error=google_not_configured`);
    }
    // Passport handles the redirect — nothing else to do here
  }

  /**
   * GET /auth/google/callback
   * Google redirects here after the user grants consent.
   * We create/log in the user then redirect to the frontend with tokens.
   */
  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any, @Res() res: Response) {
    try {
      const result = await this.authService.handleGoogleLogin(req.user);
      const { accessToken, refreshToken, isNewUser } = result;

      // Redirect to frontend callback page with tokens in query params
      const redirectUrl = new URL(`${this.frontendUrl}/auth/callback`);
      redirectUrl.searchParams.set('accessToken', accessToken);
      redirectUrl.searchParams.set('refreshToken', refreshToken);
      if (isNewUser) redirectUrl.searchParams.set('isNew', '1');

      return res.redirect(redirectUrl.toString());
    } catch {
      return res.redirect(`${this.frontendUrl}/login?error=google_failed`);
    }
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
