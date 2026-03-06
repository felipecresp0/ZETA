import {
    Injectable,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match } from './entities/match.entity';
import { ConversationsService } from '../conversations/conversations.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MatchingService {
    constructor(
    @InjectRepository(Match)
    private readonly matchRepo: Repository<Match>,
    private readonly conversationsService: ConversationsService,
    private readonly notificationsService: NotificationsService,
    ) {}
    async findMyMatches(userId: string) {
        return this.matchRepo.find({
            where: { user_id: userId, status: 'pending' },
            relations: ['matchedUser', 'matchedUser.interests', 'matchedUser.academicOffer', 'matchedUser.academicOffer.career'],
            order: { affinity_score: 'DESC', created_at: 'DESC' },
        });
    }

    async accept(matchId: string, userId: string) {
        const match = await this.findOneOrFail(matchId, userId);
        match.status = 'accepted';
        await this.matchRepo.save(match);

        // Comprobar si el otro usuario también aceptó
        const reciprocal = await this.matchRepo.findOne({
            where: {
                user_id: match.matched_user_id,
                matched_user_id: userId,
                status: 'accepted',
            },
        });

        // Si ambos aceptaron → crear conversación directa
        if (reciprocal) {
            await this.conversationsService.findOrCreateDirect(userId, match.matched_user_id);
            return { ...match, mutual: true, message: '¡Match mutuo! Se ha creado una conversación.' };
        }

        return { ...match, mutual: false };
    }

    async reject(matchId: string, userId: string) {
        const match = await this.findOneOrFail(matchId, userId);
        match.status = 'rejected';
        return this.matchRepo.save(match);
    }

    private async findOneOrFail(matchId: string, userId: string) {
        const match = await this.matchRepo.findOne({
            where: { id: matchId },
            relations: ['matchedUser'],
        });

        if (!match) throw new NotFoundException('Match not found');
        if (match.user_id !== userId) throw new ForbiddenException('Not your match');

        return match;
    }

    // Matches aceptados (pantalla de conexiones)
    async findMyConnections(userId: string) {
        return this.matchRepo.find({
            where: { user_id: userId, status: 'accepted' },
            relations: ['matchedUser', 'matchedUser.interests', 'matchedUser.academicOffer', 'matchedUser.academicOffer.career'],
            order: { created_at: 'DESC' },
        });
    }

    async notifyMatches(userIds: string[], matchCount: number) {
        await this.notificationsService.sendMatchNotification(userIds, matchCount);
        return { message: 'Notificaciones enviadas' };
    }
}