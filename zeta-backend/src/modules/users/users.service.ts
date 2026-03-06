import {
    Injectable, NotFoundException, ForbiddenException, ConflictException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from './entities/user.entity';
import { Interest } from '../interests/entities/interest.entity';
import { Connection } from './entities/connection.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { NotificationsService } from '../notifications/notifications.service';
import axios from 'axios';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Interest)
        private readonly interestRepo: Repository<Interest>,
        @InjectRepository(Connection)
        private readonly connRepo: Repository<Connection>,
        private readonly notificationsService: NotificationsService,
    ) { }

    async getMyProfile(userId: string): Promise<User> {
        const user = await this.userRepo.findOne({
            where: { id: userId },
            relations: [
                'interests',
                'academicOffer',
                'academicOffer.university',
                'academicOffer.career',
            ],
        });

        if (!user) throw new NotFoundException('Usuario no encontrado');
        return user;
    }

    async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
        const user = await this.userRepo.findOne({
            where: { id: userId },
            relations: ['interests'],
        });

        if (!user) throw new NotFoundException('Usuario no encontrado');

        if (dto.name !== undefined) user.name = dto.name;
        if (dto.photos !== undefined) user.photos = dto.photos;
        if (dto.academic_offer_id !== undefined) user.academic_offer_id = dto.academic_offer_id;
        if (dto.year !== undefined) user.year = dto.year;
        if (dto.privacy !== undefined) user.privacy = dto.privacy;

        if (dto.interest_ids !== undefined) {
            if (dto.interest_ids.length > 0) {
                user.interests = await this.interestRepo.findBy({
                    id: In(dto.interest_ids),
                });
            } else {
                user.interests = [];
            }
        }

        const saved = await this.userRepo.save(user);

        // ── Disparar matching IA si completó onboarding ──
        if (dto.interest_ids && dto.interest_ids.length > 0 && dto.academic_offer_id) {
            const n8nUrl = process.env.N8N_WEBHOOK_MATCHING || 'http://localhost:5678/webhook/matching';
            axios.post(n8nUrl, { user_id: userId })
                .catch(err => console.error('[Matching] Error al disparar n8n:', err.message));
        }

        return this.getMyProfile(userId);
    }

    // ── Ver perfil de otro usuario (respetando privacidad) ──
    async getUserProfile(targetId: string, requesterId: string): Promise<Partial<User>> {
        const target = await this.userRepo.findOne({
            where: { id: targetId },
            relations: [
                'interests',
                'academicOffer',
                'academicOffer.university',
                'academicOffer.career',
            ],
        });

        if (!target) throw new NotFoundException('Usuario no encontrado');

        // Si es público, devolver todo
        if (target.privacy === 'public') {
            return this.sanitize(target);
        }

        // Si es "university", comprobar que comparten universidad
        if (target.privacy === 'university') {
            const requester = await this.userRepo.findOne({
                where: { id: requesterId },
                relations: ['academicOffer'],
            });

            if (
                requester?.academicOffer?.university_id &&
                target.academicOffer?.university_id &&
                requester.academicOffer.university_id === target.academicOffer.university_id
            ) {
                return this.sanitize(target);
            }

            throw new ForbiddenException('Este perfil solo es visible para estudiantes de su universidad');
        }

        // Si es "career", comprobar que comparten oferta académica
        if (target.privacy === 'career') {
            const requester = await this.userRepo.findOne({
                where: { id: requesterId },
            });

            if (
                requester?.academic_offer_id &&
                target.academic_offer_id &&
                requester.academic_offer_id === target.academic_offer_id
            ) {
                return this.sanitize(target);
            }

            throw new ForbiddenException('Este perfil solo es visible para compañeros de carrera');
        }

        return this.sanitize(target);
    }

    // ── Elimina password de la respuesta ──
    private sanitize(user: User) {
        const { password, ...result } = user;
        return result;
    }

    async updatePushToken(userId: string, pushToken: string) {
        await this.userRepo.update(userId, { push_token: pushToken });
        return { message: 'Push token guardado' };
    }

    // ── Conexiones ──

    async sendConnection(senderId: string, receiverId: string) {
        if (senderId === receiverId) {
            throw new ConflictException('No puedes conectarte contigo mismo');
        }

        // Verificar que no exista ya una conexión en cualquier dirección
        const existing = await this.connRepo
            .createQueryBuilder('c')
            .where(
                '(c.sender_id = :a AND c.receiver_id = :b) OR (c.sender_id = :b AND c.receiver_id = :a)',
                { a: senderId, b: receiverId },
            )
            .getOne();

        if (existing) {
            if (existing.status === 'accepted') {
                throw new ConflictException('Ya estáis conectados');
            }
            if (existing.status === 'pending') {
                throw new ConflictException('Ya hay una solicitud pendiente');
            }
            // Si fue rechazada, permitir reenviar
            existing.sender_id = senderId;
            existing.receiver_id = receiverId;
            existing.status = 'pending';
            return this.connRepo.save(existing);
        }

        const conn = this.connRepo.create({
            sender_id: senderId,
            receiver_id: receiverId,
            status: 'pending',
        });
        const saved = await this.connRepo.save(conn);

        // Notificar al receptor
        const sender = await this.userRepo.findOne({ where: { id: senderId }, select: ['id', 'name'] });
        await this.notificationsService.create({
            userId: receiverId,
            type: 'connection_request',
            title: 'Solicitud de conexion',
            body: `${sender?.name || 'Alguien'} quiere conectar contigo`,
            data: { connectionId: saved.id, senderId },
        });

        return saved;
    }

    async respondConnection(connectionId: string, userId: string, status: 'accepted' | 'rejected') {
        const conn = await this.connRepo.findOne({
            where: { id: connectionId },
            relations: ['sender'],
        });

        if (!conn) throw new NotFoundException('Solicitud no encontrada');
        if (conn.receiver_id !== userId) {
            throw new ForbiddenException('No puedes responder a esta solicitud');
        }

        conn.status = status;
        const saved = await this.connRepo.save(conn);

        if (status === 'accepted') {
            // Notificar al sender que su solicitud fue aceptada
            const receiver = await this.userRepo.findOne({ where: { id: userId }, select: ['id', 'name'] });
            await this.notificationsService.create({
                userId: conn.sender_id,
                type: 'connection_accepted',
                title: 'Conexion aceptada',
                body: `${receiver?.name || 'Alguien'} ha aceptado tu solicitud`,
                data: { connectionId: conn.id, userId },
            });
        }

        return saved;
    }

    async getPendingConnections(userId: string) {
        return this.connRepo.find({
            where: { receiver_id: userId, status: 'pending' },
            relations: ['sender'],
            order: { created_at: 'DESC' },
        });
    }

    async getConnectionStatus(userId: string, targetId: string) {
        const conn = await this.connRepo
            .createQueryBuilder('c')
            .where(
                '(c.sender_id = :a AND c.receiver_id = :b) OR (c.sender_id = :b AND c.receiver_id = :a)',
                { a: userId, b: targetId },
            )
            .getOne();

        if (!conn) return { status: 'none', connection_id: null };

        return {
            status: conn.status,
            connection_id: conn.id,
            is_sender: conn.sender_id === userId,
        };
    }
}