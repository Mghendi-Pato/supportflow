import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { ApiKeysService } from '../api-keys.service';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  constructor(private readonly apiKeysService: ApiKeysService) {
    super();
  }

  async validate(req: Request) {
    const rawKey =
      (req.headers['x-api-key'] as string) ||
      (req.query['api_key'] as string);

    if (!rawKey) {
      throw new UnauthorizedException('No API key provided');
    }

    const payload = await this.apiKeysService.validate(rawKey);
    if (!payload) {
      throw new UnauthorizedException('Invalid or revoked API key');
    }

    return payload;
  }
}
