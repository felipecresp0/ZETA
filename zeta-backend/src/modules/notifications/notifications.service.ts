// src/modules/notifications/notifications.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../users/entities/user.entity';

@Injectable()
export class NotificationsService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
    ) {}

    async sendMatchNotification(userIds: string[], matchCount: number) {
        const users = await this.userRepo.find({
            where: { id: In(userIds) },
            select: ['id', 'push_token'],
        });

        const tokens = users
            .filter(u => u.push_token)
            .map(u => u.push_token);

        if (tokens.length === 0) return;

        // Enviar via Expo Push API
        const messages = tokens.map(token => ({
            to: token,
            sound: 'default',
            title: '¡Nuevos matches! 🎉',
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