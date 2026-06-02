import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      // Fall back to placeholder values so the app boots even when Google OAuth
      // credentials haven't been configured yet. The controller guards the
      // actual /auth/google route and returns a clear error in that case.
      clientID:     config.get<string>('GOOGLE_CLIENT_ID')     || 'GOOGLE_CLIENT_ID_NOT_SET',
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET') || 'GOOGLE_CLIENT_SECRET_NOT_SET',
      callbackURL:  config.get<string>('GOOGLE_CALLBACK_URL')  || 'http://localhost:3002/api/v1/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const { id, emails, name, photos } = profile;
    const email = emails?.[0]?.value ?? null;

    const user = {
      googleId:  id,
      email,
      firstName: name?.givenName  ?? '',
      lastName:  name?.familyName ?? '',
      avatarUrl: photos?.[0]?.value ?? null,
    };

    done(null, user);
  }
}
