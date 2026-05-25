import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatResolver } from './chat.resolver';
import { ChatService } from './chat.service';
import { pubSubProvider } from './pubsub.provider';
import { GqlAuthGuard } from './guards/gql-auth.guard';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({}), // config read from ConfigService in guard
  ],
  providers: [ChatResolver, ChatService, GqlAuthGuard, pubSubProvider],
  exports: [pubSubProvider], // PubSub can be injected into NotificationsService for live notif push
})
export class ChatModule {}
