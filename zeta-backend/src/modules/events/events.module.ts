import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from './entities/event.entity';
import { GroupMember } from '../groups/entities/group-member.entity';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
    imports: [TypeOrmModule.forFeature([Event, GroupMember])],
    controllers: [EventsController],
    providers: [EventsService],
    exports: [EventsService],
})
export class EventsModule { }