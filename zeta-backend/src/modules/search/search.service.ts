import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Group } from '../groups/entities/group.entity';
import { Event } from '../events/entities/event.entity';

@Injectable()
export class SearchService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Group)
        private readonly groupRepo: Repository<Group>,
        @InjectRepository(Event)
        private readonly eventRepo: Repository<Event>,
    ) {}

    async searchUsers(query: string, requesterId: string) {
        if (!query || query.length < 2) return [];

        const results = await this.userRepo
            .createQueryBuilder('u')
            .leftJoinAndSelect('u.academicOffer', 'ao')
            .leftJoinAndSelect('ao.university', 'uni')
            .leftJoinAndSelect('ao.career', 'career')
            .leftJoinAndSelect('u.interests', 'interest')
            .where('u.id != :requesterId', { requesterId })
            .andWhere('LOWER(u.name) LIKE LOWER(:q)', { q: `%${query}%` })
            .take(20)
            .getMany();

        return results.map(u => {
            const { password, ...safe } = u;
            return safe;
        });
    }

    async searchGroups(query: string, userId: string) {
        if (!query || query.length < 2) return [];

        return this.groupRepo
            .createQueryBuilder('g')
            .leftJoinAndSelect('g.members', 'member')
            .where(
                'LOWER(g.name) LIKE LOWER(:q) OR LOWER(g.description) LIKE LOWER(:q) OR LOWER(g.type) LIKE LOWER(:q)',
                { q: `%${query}%` },
            )
            .orderBy('g.created_at', 'DESC')
            .take(20)
            .getMany();
    }

    async searchEvents(query: string) {
        if (!query || query.length < 2) return [];

        return this.eventRepo
            .createQueryBuilder('e')
            .leftJoinAndSelect('e.group', 'group')
            .leftJoinAndSelect('e.creator', 'creator')
            .where(
                'LOWER(e.name) LIKE LOWER(:q) OR LOWER(e.location) LIKE LOWER(:q) OR LOWER(e.description) LIKE LOWER(:q)',
                { q: `%${query}%` },
            )
            .andWhere('e.event_date >= :now', { now: new Date() })
            .orderBy('e.event_date', 'ASC')
            .take(20)
            .getMany();
    }
}
