import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { ClientsModule } from './modules/clients/clients.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { BillingModule } from './modules/billing/billing.module';
import { ChatModule } from './modules/chat/chat.module';

@Module({
  imports: [
    // Config — loads .env globally
    ConfigModule.forRoot({ isGlobal: true }),

    // GraphQL — code-first, with WebSocket subscriptions
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        autoSchemaFile: true,
        sortSchema: true,
        path: '/graphql',
        // WS subscriptions for real-time chat
        subscriptions: {
          'graphql-ws': {
            path: '/graphql',
            onConnect: (context: any) => {
              // Extract JWT from connection params for subscription auth
              const token: string =
                context.connectionParams?.Authorization?.replace('Bearer ', '') ??
                context.connectionParams?.authorization?.replace('Bearer ', '') ??
                '';
              return { token };
            },
          },
        },
        // Build GQL context from HTTP request OR WS connection params
        context: ({ req, extra }: any) => {
          if (req) return { req };
          // WebSocket context — token was extracted in onConnect
          return { token: extra?.token };
        },
        playground: config.get('NODE_ENV') !== 'production',
        introspection: true,
      }),
    }),

    // JWT — needed for GqlAuthGuard
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_ACCESS_SECRET'),
      }),
    }),

    // Database
    PrismaModule,

    // Feature modules
    AuthModule,
    TenantsModule,
    UsersModule,
    ClientsModule,
    TicketsModule,
    NotificationsModule,
    UploadsModule,
    AnalyticsModule,
    BillingModule,
    ChatModule,
  ],
})
export class AppModule {}
