import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Group } from '../groups/entities/group.entity';
import { Event } from '../events/entities/event.entity';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
    imports: [TypeOrmModule.forFeature([User, Group, Event])],
    controllers: [SearchController],
    providers: [SearchService],
})
export class SearchModule {}
