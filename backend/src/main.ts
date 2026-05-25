import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global API prefix — exclude /graphql so it stays at root path
  app.setGlobalPrefix('api/v1', { exclude: ['graphql'] });

  // CORS — allow frontend origin
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation pipe — strips unknown fields, auto-transforms types
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global exception filter — normalises all errors to consistent JSON shape
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global response interceptor — wraps all responses in { success, data, timestamp }
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Swagger API documentation (dev + staging only)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('SupportFlow API')
      .setDescription(
        'Client Support Portal SaaS — REST API reference\n\n' +
        'All endpoints require Bearer JWT authentication unless marked Public.',
      )
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .addTag('Auth', 'Authentication — register, login, refresh, invite')
      .addTag('Workspace (Tenant)', 'Workspace management and member invitations')
      .addTag('Clients', 'Client management and portal access')
      .addTag('Tickets', 'Support ticket lifecycle — create, update, comment, assign')
      .addTag('Uploads', 'File uploads via Cloudinary')
      .addTag('Notifications', 'In-app notification management')
      .addTag('Analytics', 'Dashboard metrics and reporting')
      .addTag('Users', 'Profile management and super admin controls')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`\n🚀 SupportFlow API running on: http://localhost:${port}/api/v1`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📚 Swagger docs:               http://localhost:${port}/api/docs`);
  }
  console.log(`🌍 Environment:                ${process.env.NODE_ENV || 'development'}\n`);
}

bootstrap();
