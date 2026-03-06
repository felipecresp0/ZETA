import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { Event } from './entities/event.entity';
import { EventRsvp } from './entities/event-rsvp.entity';
import { GroupMember } from '../groups/entities/group-member.entity';
import { Message, MessageSchema } from '../chat/schemas/message.schema';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Event, EventRsvp, GroupMember]),
        MongooseModule.forFeature([{ name: Message.name, schema: MessageSchema }]),
        NotificationsModule,
    ],
    controllers: [EventsController],
    providers: [EventsService],
    exports: [EventsService],
})
export class EventsModule { }