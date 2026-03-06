// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { UniversitiesModule } from './modules/universities/universities.module';
import { InterestsModule } from './modules/interests/interests.module';
import { GroupsModule } from './modules/groups/groups.module';
import { EventsModule } from './modules/events/events.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { ChatModule } from './modules/chat/chat.module';
import { MatchingModule } from './modules/matching/matching.module';
import { SeedModule } from './seeds/seed.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SearchModule } from './modules/search/search.module';

@Module({
  imports: [
    // ── Variables de entorno globales ──
    ConfigModule.forRoot({ isGlobal: true }),

    // ── PostgreSQL (datos relacionales) ──
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'zeta_admin',
      password: process.env.DB_PASSWORD || 'zeta_dev_2025',
      database: process.env.DB_NAME || 'zeta_db',
      autoLoadEntities: true,
      synchronize: true,
      logging: process.env.NODE_ENV === 'development',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    }),

    // ── MongoDB (mensajería en tiempo real) ──
    MongooseModule.forRoot(
      process.env.MONGO_URI || 'mongodb://localhost:27017/zeta_chat',
    ),

    // ── Módulos funcionales ──
    AuthModule,
    UsersModule,
    UniversitiesModule,
    InterestsModule,
    GroupsModule,
    EventsModule,
    TasksModule,
    ConversationsModule,
    ChatModule,
    MatchingModule,
    SeedModule,
    UploadsModule,
    NotificationsModule,
    SearchModule,
  ],
})
export class AppModule { }