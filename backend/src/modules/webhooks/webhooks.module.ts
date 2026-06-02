import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { InboundEmailService } from './inbound-email.service';

@Module({
  controllers: [WebhooksController],
  providers:   [InboundEmailService],
  // EmailService is available globally via @Global() NotificationsModule
})
export class WebhooksModule {}
