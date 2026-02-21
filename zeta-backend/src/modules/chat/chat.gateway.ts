import {
    WebSocketGateway, WebSocketServer,
    SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect,
    ConnectedSocket, MessageBody
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from '../conversations/entities/conversation.entity';
import { User } from '../users/entities/user.entity';

// Mapa de usuarios conectados: userId -> Set<socketId>
// Un usuario puede tener múltiples conexiones (móvil + web)
const onlineUsers = new Map<string, Set<string>>();

@WebSocketGateway({
    cors: { origin: '*' },      // Expo Go necesita acceso libre
    namespace: '/chat',          // ws://localhost:3000/chat
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(ChatGateway.name);

    constructor(
        private readonly chatService: ChatService,
        private readonly jwtService: JwtService,
        @InjectRepository(Conversation)
        private readonly convRepo: Repository<Conversation>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
    ) { }

    // ── Conexión: autenticar con JWT y unir a rooms ──
    async handleConnection(client: Socket) {
        try {
            // Extraer token del handshake
            const token =
                client.handshake.auth?.token ||
                client.handshake.headers?.authorization?.replace('Bearer ', '');

            if (!token) {
                this.logger.warn(`Cliente sin token: ${client.id}`);
                client.disconnect();
                return;
            }

            // Verificar JWT
            const payload = this.jwtService.verify(token);
            const userId = payload.sub;

            // Guardar userId en el socket para uso posterior
            (client as any).userId = userId;

            // Registrar conexión
            if (!onlineUsers.has(userId)) {
                onlineUsers.set(userId, new Set());
            }
            onlineUsers.get(userId)!.add(client.id);

            // Unir al socket a todas sus conversaciones como rooms
            const conversations = await this.convRepo
                .createQueryBuilder('conv')
                .where(':userId = ANY(conv.participant_ids)', { userId })
                .getMany();

            for (const conv of conversations) {
                client.join(`conv:${conv.id}`);
            }

            this.logger.log(`Conectado: ${userId} (${client.id}) — ${conversations.length} rooms`);

            // Notificar a otros que el usuario está online
            this.server.emit('user:online', { userId });

        } catch (err) {
            this.logger.warn(`Auth fallida: ${client.id} — ${(err as Error).message}`);
            client.disconnect();
        }
    }

    // ── Desconexión ──
    handleDisconnect(client: Socket) {
        const userId = (client as any).userId;
        if (userId && onlineUsers.has(userId)) {
            onlineUsers.get(userId)!.delete(client.id);
            if (onlineUsers.get(userId)!.size === 0) {
                onlineUsers.delete(userId);
                // Notificar que el usuario está offline
                this.server.emit('user:offline', { userId });
            }
        }
        this.logger.log(`Desconectado: ${userId || 'unknown'} (${client.id})`);
    }

    // ── Enviar mensaje ──
    @SubscribeMessage('message:send')
    async handleSendMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { conversation_id: string; content: string; type?: string; attachment_url?: string },
    ) {
        const userId = (client as any).userId;
        if (!userId) return;

        // Obtener nombre del usuario para el preview
        const user = await this.userRepo.findOne({ where: { id: userId } });
        const senderName = user?.name || 'Usuario';

        try {
            const message = await this.chatService.saveMessage(
                data.conversation_id,
                userId,
                senderName,
                data.content,
                data.type || 'text',
                data.attachment_url,
            );

            // Emitir a todos en la room de la conversación (incluido el emisor)
            this.server.to(`conv:${data.conversation_id}`).emit('message:new', message);

            // Emitir actualización de preview para la lista de chats
            this.server.to(`conv:${data.conversation_id}`).emit('conversation:updated', {
                conversation_id: data.conversation_id,
                last_message_preview: `${senderName}: ${data.content.substring(0, 80)}`,
                last_message_at: new Date(),
            });

        } catch (err) {
            client.emit('message:error', { error: (err as Error).message });
        }
    }

    // ── Typing indicator ──
    @SubscribeMessage('typing:start')
    handleTypingStart(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { conversation_id: string },
    ) {
        const userId = (client as any).userId;
        if (!userId) return;

        // Emitir a todos en la room EXCEPTO al que escribe
        client.to(`conv:${data.conversation_id}`).emit('typing:update', {
            conversation_id: data.conversation_id,
            user_id: userId,
            is_typing: true,
        });
    }

    @SubscribeMessage('typing:stop')
    handleTypingStop(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { conversation_id: string },
    ) {
        const userId = (client as any).userId;
        if (!userId) return;

        client.to(`conv:${data.conversation_id}`).emit('typing:update', {
            conversation_id: data.conversation_id,
            user_id: userId,
            is_typing: false,
        });
    }

    // ── Marcar como leído ──
    @SubscribeMessage('messages:read')
    async handleMarkAsRead(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { conversation_id: string },
    ) {
        const userId = (client as any).userId;
        if (!userId) return;

        await this.chatService.markAsRead(data.conversation_id, userId);

        // Notificar al emisor original que sus mensajes fueron leídos
        this.server.to(`conv:${data.conversation_id}`).emit('messages:read', {
            conversation_id: data.conversation_id,
            read_by: userId,
        });
    }

    // ── Unirse a una conversación nueva (cuando te unes a un grupo) ──
    @SubscribeMessage('conversation:join')
    handleJoinConversation(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { conversation_id: string },
    ) {
        client.join(`conv:${data.conversation_id}`);
        this.logger.log(`${(client as any).userId} joined conv:${data.conversation_id}`);
    }

    // ── Utilidad: verificar si un usuario está online ──
    static isUserOnline(userId: string): boolean {
        return onlineUsers.has(userId) && onlineUsers.get(userId)!.size > 0;
    }
}