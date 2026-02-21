// src/main.ts
import { ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { SeedService } from './seeds/seed.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const cfg = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // ── Prefijo global para todas las rutas ──
  app.setGlobalPrefix('api');

  // ── Validación automática de DTOs ──
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,        // Elimina campos no definidos en el DTO
      forbidNonWhitelisted: true,  // Error si envían campos extra
      transform: true,        // Transforma tipos automáticamente
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // ── CORS — Expo Go necesita acceso desde el móvil ──
  app.enableCors({
    origin: '*',              // En producción, restringir a dominios específicos
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // ── Ejecutar seed en desarrollo ──
  if (cfg.get('NODE_ENV') === 'development') {
    try {
      const seedService = app.get(SeedService);
      await seedService.run();
    } catch (e) {
      logger.warn('Seed ya ejecutado o error en seed: ' + e.message);
    }
  }

  const port = cfg.get('PORT', 3000);
  await app.listen(port);
  logger.log(`Zeta Backend corriendo en http://localhost:${port}/api`);
  logger.log(`WebSocket disponible en ws://localhost:${port}`);
}

bootstrap();