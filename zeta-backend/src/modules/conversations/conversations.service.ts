import {
    Injectable, NotFoundException, ConflictException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { ChatService } from '../chat/chat.service';

@Injectable()
export class ConversationsService {
    constructor(
        @InjectRepository(Conversation)
        private readonly convRepo: Repository<Conversation>,
        private readonly chatService: ChatService,
    ) { }

    // ── Lista de conversaciones del usuario (para pantalla de chats) ──
    async findMyConversations(userId: string) {
        const conversations = await this.convRepo
            .createQueryBuilder('conv')
            .leftJoinAndSelect('conv.group', 'group')
            .where(':userId = ANY(conv.participant_ids)', { userId })
            .orderBy('conv.last_message_at', 'DESC')
            .getMany();

        // Añadir conteo de no leídos a cada conversación
        const result: any[] = [];
        for (const conv of conversations) {
            const unread = await this.chatService.getUnreadCount(conv.id, userId);
            result.push({
                ...conv,
                unread_count: unread,
            });
        }

        return result;
    }

    // ── Crear chat directo 1:1 (o devolver si ya existe) ──
    async findOrCreateDirect(userId: string, targetUserId: string) {
        if (userId === targetUserId) {
            throw new ConflictException('No puedes chatear contigo mismo');
        }

        // Buscar si ya existe una conversación directa entre ambos
        const existing = await this.convRepo
            .createQueryBuilder('conv')
            .where('conv.type = :type', { type: 'direct' })
            .andWhere(':userId = ANY(conv.participant_ids)', { userId })
            .andWhere(':targetId = ANY(conv.participant_ids)', { targetId: targetUserId })
            .getOne();

        if (existing) return existing;

        // Crear nueva conversación directa
        const conv = this.convRepo.create({
            type: 'direct',
            participant_ids: [userId, targetUserId],
        });

        return this.convRepo.save(conv);
    }

    // ── Obtener conversación por ID ──
    async findOne(convId: string, userId: string) {
        const conv = await this.convRepo.findOne({
            where: { id: convId },
            relations: ['group'],
        });

        if (!conv) throw new NotFoundException('Conversación no encontrada');
        if (!conv.participant_ids?.includes(userId)) {
            throw new NotFoundException('Conversación no encontrada');
        }

        return conv;
    }
    // ── Obtener conversación de un grupo ──
    async findByGroup(groupId: string, userId: string) {
        let conv = await this.convRepo.findOne({
            where: { group_id: groupId, type: 'group' },
        });

        // Si no existe, crearla (puede pasar si el grupo se creó
        // antes de implementar la creación automática de conversación)
        if (!conv) {
            conv = this.convRepo.create({
                type: 'group',
                group_id: groupId,
                participant_ids: [userId],
            });
            conv = await this.convRepo.save(conv);
        }

        return conv;
    }
}