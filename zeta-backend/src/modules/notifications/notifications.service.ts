import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Notification } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Notification)
        private readonly notifRepo: Repository<Notification>,
    ) {}

    // ── Crear notificación genérica ──
    async create(params: {
        userId: string;
        type: string;
        title: string;
        body: string;
        data?: Record<string, any>;
    }) {
        const notif = this.notifRepo.create({
            user_id: params.userId,
            type: params.type,
            title: params.title,
            body: params.body,
            data: params.data || {},
        });
        return this.notifRepo.save(notif);
    }

    // ── Listar notificaciones de un usuario ──
    async getMyNotifications(userId: string) {
        return this.notifRepo.find({
            where: { user_id: userId },
            order: { created_at: 'DESC' },
            take: 50,
        });
    }

    // ── Marcar como leída ──
    async markAsRead(notifId: string, userId: string) {
        await this.notifRepo.update(
            { id: notifId, user_id: userId },
            { read: true },
        );
        return { message: 'Marcada como leída' };
    }

    // ── Marcar todas como leídas ──
    async markAllAsRead(userId: string) {
        await this.notifRepo.update(
            { user_id: userId, read: false },
            { read: true },
        );
        return { message: 'Todas marcadas como leídas' };
    }

    // ── Contador de no leídas ──
    async getUnreadCount(userId: string) {
        const count = await this.notifRepo.count({
            where: { user_id: userId, read: false },
        });
        return { count };
    }

    // ── Push notification (Expo) ──
    async sendMatchNotification(userIds: string[], matchCount: number) {
        const users = await this.userRepo.find({
            where: { id: In(userIds) },
            select: ['id', 'push_token'],
        });

        // Crear notificación en BD para cada usuario
        for (const u of users) {
            await this.create({
                userId: u.id,
                type: 'match',
                title: 'Nuevos matches!',
                body: `Tienes ${matchCount} nuevas sugerencias de compañeros`,
                data: { screen: 'Match' },
            });
        }

        const tokens = users
            .filter(u => u.push_token)
            .map(u => u.push_token);

        if (tokens.length === 0) return;

        const messages = tokens.map(token => ({
            to: token,
            sound: 'default',
            title: 'Nuevos matches!',
            body: `Tienes ${matchCount} nuevas sugerencias de compañeros`,
            data: { screen: 'Match' },
        }));

        try {
            await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(messages),
            });
        } catch (err) {
            console.error('Error enviando push:', err);
        }
    }
}
