import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';

async function bootstrap() {
  if (process.env.NODE_ENV === 'production') {
    const jwtSecret = process.env.JWT_SECRET;
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
    if (!jwtSecret || jwtSecret.length < 32) {
      throw new Error('FATAL: JWT_SECRET must be set and >= 32 characters in production');
    }
    if (!jwtRefreshSecret || jwtRefreshSecret.length < 32) {
      throw new Error('FATAL: JWT_REFRESH_SECRET must be set and >= 32 characters in production');
    }
  }

  const app = await NestFactory.create(AppModule);

  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
    : ['http://localhost:8081', 'http://localhost:3001'];

  app.use(helmet());
  app.use(compression());
  app.use(new CorrelationIdMiddleware().use);
  app.useGlobalInterceptors(
    new IdempotencyInterceptor(),
    new TimeoutInterceptor(30000),
  );
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  app.setGlobalPrefix('v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('diriddle API')
    .setDescription('Anonymous location-based social network API — India')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`diriddle API listening on http://localhost:${port}/v1`);
  console.log(`Swagger docs available at http://localhost:${port}/docs`);
}

bootstrap();

