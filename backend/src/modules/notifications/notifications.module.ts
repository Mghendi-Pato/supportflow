import { Global, Module } from '@nestjs/common';
import { EmailService } from './email/email.service';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

@Global() // EmailService and NotificationsService available everywhere without re-importing
@Module({
  controllers: [NotificationsController],
  providers: [EmailService, NotificationsService],
  exports: [EmailService, NotificationsService],
})
export class NotificationsModule {}
