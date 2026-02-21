import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRepository } from '@nestjs/typeorm';
import { Model } from 'mongoose';
import { Repository } from 'typeorm';
import { Message, MessageDocument } from './schemas/message.schema';
import { Conversation } from '../conversations/entities/conversation.entity';

@Injectable()
export class ChatService {
    constructor(
        @InjectModel(Message.name)
        private readonly messageModel: Model<MessageDocument>,
        @InjectRepository(Conversation)
        private readonly convRepo: Repository<Conversation>,
    ) { }

    // ── Guardar mensaje en MongoDB + actualizar preview en PostgreSQL ──
    async saveMessage(
        conversationId: string,
        senderId: string,
        senderName: string,
        content: string,
        type: string = 'text',
        attachmentUrl?: string,
    ) {
        // 1. Verificar que el usuario es participante
        const conv = await this.convRepo.findOne({
            where: { id: conversationId },
        });

        if (!conv) throw new ForbiddenException('Conversación no encontrada');

        const isParticipant = conv.participant_ids?.includes(senderId);
        if (!isParticipant) {
            throw new ForbiddenException('No eres participante de esta conversación');
        }

        // 2. Guardar mensaje en MongoDB
        const readBy = new Map<string, boolean>();
        // El emisor ya lo ha "leído"
        readBy.set(senderId, true);
        // El resto como no leído
        for (const pid of conv.participant_ids || []) {
            if (pid !== senderId) readBy.set(pid, false);
        }

        const message = new this.messageModel({
            conversation_id: conversationId,
            sender_id: senderId,
            content,
            type,
            attachment_url: attachmentUrl || null,
            read_by: readBy,
        });

        const saved = await message.save();

        // 3. Actualizar preview en PostgreSQL (para la lista de chats)
        const preview =
            type === 'text'
                ? `${senderName}: ${content.substring(0, 80)}`
                : `${senderName} envió ${type === 'image' ? 'una imagen' : 'un archivo'}`;

        conv.last_message_preview = preview;
        conv.last_message_at = new Date();
        await this.convRepo.save(conv);

        return {
            _id: saved._id,
            conversation_id: saved.conversation_id,
            sender_id: saved.sender_id,
            sender_name: senderName,
            content: saved.content,
            type: saved.type,
            attachment_url: saved.attachment_url,
            createdAt: (saved as any).createdAt,
        };
    }

    // ── Obtener mensajes de una conversación (paginado) ──
    async getMessages(conversationId: string, userId: string, page: number = 1, limit: number = 50) {
        // Verificar participación
        const conv = await this.convRepo.findOne({
            where: { id: conversationId },
        });

        if (!conv || !conv.participant_ids?.includes(userId)) {
            throw new ForbiddenException('No tienes acceso a esta conversación');
        }

        const skip = (page - 1) * limit;

        const messages = await this.messageModel
            .find({ conversation_id: conversationId })
            .sort({ createdAt: -1 })    // Más recientes primero
            .skip(skip)
            .limit(limit)
            .lean();

        // Devolver en orden cronológico para el frontend
        return messages.reverse();
    }

    // ── Marcar mensajes como leídos ──
    async markAsRead(conversationId: string, userId: string) {
        await this.messageModel.updateMany(
            {
                conversation_id: conversationId,
                [`read_by.${userId}`]: false,
            },
            {
                $set: { [`read_by.${userId}`]: true },
            },
        );

        return { marked: true };
    }

    // ── Contar mensajes no leídos por conversación ──
    async getUnreadCount(conversationId: string, userId: string): Promise<number> {
        return this.messageModel.countDocuments({
            conversation_id: conversationId,
            [`read_by.${userId}`]: false,
        });
    }
}