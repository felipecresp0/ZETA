import {
    Injectable, NotFoundException, ForbiddenException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectModel } from '@nestjs/mongoose';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Model } from 'mongoose';
import { Event } from './entities/event.entity';
import { EventRsvp } from './entities/event-rsvp.entity';
import { GroupMember } from '../groups/entities/group-member.entity';
import { Message, MessageDocument } from '../chat/schemas/message.schema';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EventsService {
    constructor(
        @InjectRepository(Event)
        private readonly eventRepo: Repository<Event>,
        @InjectRepository(EventRsvp)
        private readonly rsvpRepo: Repository<EventRsvp>,
        @InjectRepository(GroupMember)
        private readonly memberRepo: Repository<GroupMember>,
        @InjectModel(Message.name)
        private readonly messageModel: Model<MessageDocument>,
        private readonly notificationsService: NotificationsService,
    ) { }

    // ── Crear evento dentro de un grupo ──
    async create(dto: CreateEventDto, userId: string) {
        // Verificar que el usuario es miembro del grupo
        await this.assertMember(dto.group_id, userId);

        const event = this.eventRepo.create({
            name: dto.name,
            description: dto.description,
            event_date: new Date(dto.event_date),
            location: dto.location,
            group_id: dto.group_id,
            creator_id: userId,
        });

        const saved = await this.eventRepo.save(event);

        // Auto-RSVP "going" para el creador
        const rsvp = this.rsvpRepo.create({
            event_id: saved.id,
            user_id: userId,
            status: 'going',
        });
        await this.rsvpRepo.save(rsvp);

        return this.findOne(saved.id);
    }

    // ── Eventos de un grupo ──
    async findByGroup(groupId: string) {
        return this.eventRepo.find({
            where: { group_id: groupId },
            relations: ['creator'],
            order: { event_date: 'ASC' },
        });
    }

    // ── Mis eventos próximos (RSVP "going" o soy el creador) ──
    async findMyUpcoming(userId: string) {
        const goingRsvps = await this.rsvpRepo.find({
            where: { user_id: userId, status: 'going' },
        });
        const goingEventIds = goingRsvps.map(r => r.event_id);

        const qb = this.eventRepo
            .createQueryBuilder('event')
            .leftJoinAndSelect('event.group', 'group')
            .leftJoinAndSelect('event.creator', 'creator')
            .where('event.event_date >= :now', { now: new Date() });

        if (goingEventIds.length > 0) {
            qb.andWhere(
                '(event.id IN (:...goingEventIds) OR event.creator_id = :userId)',
                { goingEventIds, userId },
            );
        } else {
            qb.andWhere('event.creator_id = :userId', { userId });
        }

        return qb
            .orderBy('event.event_date', 'ASC')
            .take(30)
            .getMany();
    }

    // ── Detalle de un evento ──
    async findOne(eventId: string) {
        const event = await this.eventRepo.findOne({
            where: { id: eventId },
            relations: ['group', 'creator'],
        });

        if (!event) throw new NotFoundException('Evento no encontrado');
        return event;
    }

    // ── Actualizar evento (solo creador del evento o admin del grupo) ──
    async update(eventId: string, dto: UpdateEventDto, userId: string) {
        const event = await this.eventRepo.findOne({ where: { id: eventId } });
        if (!event) throw new NotFoundException('Evento no encontrado');

        // Solo el creador del evento o un admin del grupo pueden editar
        if (event.creator_id !== userId) {
            const member = await this.memberRepo.findOne({
                where: { group_id: event.group_id, user_id: userId },
            });
            if (!member || member.role !== 'admin') {
                throw new ForbiddenException('No tienes permiso para editar este evento');
            }
        }

        if (dto.event_date) {
            (dto as any).event_date = new Date(dto.event_date);
        }

        await this.eventRepo.update(eventId, dto);
        return this.findOne(eventId);
    }

    // ── Eliminar evento ──
    async remove(eventId: string, userId: string) {
        const event = await this.eventRepo.findOne({ where: { id: eventId } });
        if (!event) throw new NotFoundException('Evento no encontrado');

        // Solo el creador del evento o un admin del grupo pueden eliminar
        if (event.creator_id !== userId) {
            const member = await this.memberRepo.findOne({
                where: { group_id: event.group_id, user_id: userId },
            });
            if (!member || member.role !== 'admin') {
                throw new ForbiddenException('No tienes permiso para eliminar este evento');
            }
        }

        // Borrar mensajes de tipo "event" que contengan este eventId en MongoDB
        await this.messageModel.deleteMany({
            type: 'event',
            content: { $regex: eventId },
        });

        await this.eventRepo.remove(event);
        return { message: 'Evento eliminado' };
    }

    // ── RSVP: confirmar asistencia ──
    async rsvp(eventId: string, userId: string, status: 'going' | 'not_going') {
        const event = await this.eventRepo.findOne({ where: { id: eventId } });
        if (!event) throw new NotFoundException('Evento no encontrado');

        // Verificar que es miembro del grupo
        await this.assertMember(event.group_id, userId);

        // Upsert RSVP
        let rsvp = await this.rsvpRepo.findOne({
            where: { event_id: eventId, user_id: userId },
        });

        if (rsvp) {
            rsvp.status = status;
        } else {
            rsvp = this.rsvpRepo.create({
                event_id: eventId,
                user_id: userId,
                status,
            });
        }

        await this.rsvpRepo.save(rsvp);

        // Notificar al usuario que se ha apuntado
        if (status === 'going') {
            await this.notificationsService.create({
                userId,
                type: 'event_rsvp',
                title: 'Te has apuntado a un evento',
                body: `Asistiras a "${event.name}"`,
                data: { eventId: event.id, eventName: event.name },
            });
        }

        return this.getRsvpSummary(eventId, userId);
    }

    // ── Obtener resumen de RSVPs de un evento ──
    async getRsvpSummary(eventId: string, userId?: string) {
        const event = await this.eventRepo.findOne({ where: { id: eventId } });

        const going = await this.rsvpRepo.find({
            where: { event_id: eventId, status: 'going' },
            relations: ['user'],
        });

        const notGoing = await this.rsvpRepo.find({
            where: { event_id: eventId, status: 'not_going' },
            relations: ['user'],
        });

        let myStatus: string | null = null;
        if (userId) {
            const mine = await this.rsvpRepo.findOne({
                where: { event_id: eventId, user_id: userId },
            });
            myStatus = mine?.status || null;
        }

        return {
            going_count: going.length,
            not_going_count: notGoing.length,
            my_status: myStatus,
            is_creator: event?.creator_id === userId,
            creator_id: event?.creator_id,
            going_users: going.map(r => ({
                id: r.user?.id,
                name: r.user?.name,
            })),
            not_going_users: notGoing.map(r => ({
                id: r.user?.id,
                name: r.user?.name,
            })),
        };
    }

    // ── Helper: verificar membresía ──
    private async assertMember(groupId: string, userId: string) {
        const member = await this.memberRepo.findOne({
            where: { group_id: groupId, user_id: userId },
        });
        if (!member) {
            throw new ForbiddenException('Debes ser miembro del grupo para crear eventos');
        }
    }
}