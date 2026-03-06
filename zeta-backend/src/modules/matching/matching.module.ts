import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Match } from './entities/match.entity';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';
import { ConversationsModule } from '../conversations/conversations.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Match]),
        ConversationsModule,
        NotificationsModule,
    ],
    controllers: [MatchingController],
    providers: [MatchingService],
    exports: [MatchingService],
})
export class MatchingModule { }