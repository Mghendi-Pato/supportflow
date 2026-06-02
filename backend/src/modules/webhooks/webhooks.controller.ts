import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { InboundEmailService, ResendInboundPayload } from './inbound-email.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);
  private readonly webhookSecret: string | undefined;

  constructor(
    private readonly inboundEmail: InboundEmailService,
    private readonly config: ConfigService,
  ) {
    this.webhookSecret = config.get<string>('RESEND_WEBHOOK_SECRET');
  }

  /**
   * POST /webhooks/inbound-email
   * Called by Resend when an email arrives at any inbound address.
   * Always returns 200 — Resend retries on non-2xx responses.
   */
  @Public()
  @Post('inbound-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend inbound email webhook — creates tickets from incoming emails' })
  async handleInboundEmail(
    @Body() payload: ResendInboundPayload,
    @Headers('svix-signature') signature?: string,
  ) {
    // Optional signature check — skip in development if secret not configured
    if (this.webhookSecret && !signature) {
      this.logger.warn('Inbound email webhook received without signature — rejected');
      return { ok: false };
    }

    try {
      await this.inboundEmail.handle(payload);
    } catch (err) {
      // Log but never throw — Resend must receive 200 or it will retry endlessly
      this.logger.error('Error processing inbound email', err);
    }

    return { ok: true };
  }
}
