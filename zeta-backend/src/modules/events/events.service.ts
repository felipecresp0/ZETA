import {
    Injectable, NotFoundException, ForbiddenException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectModel } from '@nestjs/mongoose';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Model } from 'mongoose';
import axios from 'axios';
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

    // ── Crear evento (con análisis IA de conflictos) ──
    async create(dto: CreateEventDto, userId: string) {
        // Verificar membresía solo si es evento de grupo
        if (dto.group_id) {
            await this.assertMember(dto.group_id, userId);
        }

        const event = this.eventRepo.create({
            name: dto.name,
            description: dto.description,
            event_date: new Date(dto.event_date),
            location: dto.location,
            group_id: dto.group_id || null,
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

        // ── Analizar conflictos de calendario con IA (n8n + Gemini) ──
        let conflicts: {
                has_conflicts: boolean;
                conflicts: Array<{ type: string; severity: string; description: string }>;
                recommendations: string[];
                suggested_times: string[];
                summary: string;
            } | null = null;
        try {
            const n8nUrl = process.env.N8N_WEBHOOK_CALENDAR_CONFLICTS
                || 'http://localhost:5678/webhook/calendar-conflict';

            console.log('[Events] Llamando a n8n calendar-conflicts:', n8nUrl);
            console.log('[Events] Payload:', { event_id: saved.id, user_id: userId, event_date: dto.event_date, event_name: dto.name });

            const { data } = await axios.post(n8nUrl, {
                event_id: saved.id,
                user_id: userId,
                event_date: dto.event_date,
                event_name: dto.name,
            }, { timeout: 30000 });

            console.log('[Events] Respuesta n8n:', JSON.stringify(data).slice(0, 500));

            // Mapear respuesta al formato esperado por el frontend
            conflicts = {
                has_conflicts: data.has_conflicts || false,
                conflicts: data.conflicts || [],
                recommendations: data.recommendations || [],
                suggested_times: data.suggested_times || [],
                summary: data.summary || 'Análisis completado',
            };
        } catch (err) {
            // Si n8n falla, no rompemos la creación del evento
            console.error('[Events] Error al analizar conflictos:', err.message);
            if (err.code) console.error('[Events] Error code:', err.code);
            if (err.response) console.error('[Events] Response status:', err.response.status, err.response.data);
            conflicts = {
                has_conflicts: false,
                conflicts: [],
                recommendations: [],
                suggested_times: [],
                summary: 'No se pudo conectar con el asistente IA',
            };
        }

        const eventData = await this.findOne(saved.id);
        return { ...eventData, conflicts };
    }

    // ── Eventos de un grupo ──
    async findByGroup(groupId: string) {
        return this.eventRepo.find({
            where: { group_id: groupId },
            relations: ['creator'],
            order: { event_date: 'ASC' },
        });
    }

    // ── Mis eventos próximos (grupos + universitarios sin grupo) ──
    async findMyUpcoming(userId: string) {
        const memberships = await this.memberRepo.find({
            where: { user_id: userId },
        });
        const groupIds = memberships.map(m => m.group_id);

        const qb = this.eventRepo
            .createQueryBuilder('event')
            .leftJoinAndSelect('event.group', 'group')
            .leftJoinAndSelect('event.creator', 'creator')
            .where('event.event_date >= :now', { now: new Date() });

        if (groupIds.length > 0) {
            qb.andWhere('(event.group_id IN (:...groupIds) OR event.group_id IS NULL)', { groupIds });
        } else {
            qb.andWhere('event.group_id IS NULL');
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
            if (!event.group_id) throw new ForbiddenException('No tienes permiso para editar este evento');
            const member = await this.memberRepo.findOne({
                where: { group_id: event.group_id!, user_id: userId },
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
            if (!event.group_id) throw new ForbiddenException('No tienes permiso para eliminar este evento');
            const member = await this.memberRepo.findOne({
                where: { group_id: event.group_id!, user_id: userId },
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

        // Verificar membresía solo si es evento de grupo
        if (event.group_id) {
            await this.assertMember(event.group_id, userId);
        }

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

        const summary = await this.getRsvpSummary(eventId, userId);

        // ── Analizar conflictos de calendario con IA al confirmar asistencia ──
        if (status === 'going') {
            let conflicts: {
                has_conflicts: boolean;
                conflicts: Array<{ type: string; severity: string; description: string }>;
                recommendations: string[];
                suggested_times: string[];
                summary: string;
            } | null = null;
            try {
                const n8nUrl = process.env.N8N_WEBHOOK_CALENDAR_CONFLICTS
                    || 'http://localhost:5678/webhook/calendar-conflict';

                console.log('[Events RSVP] Llamando a n8n calendar-conflicts:', n8nUrl);

                const { data } = await axios.post(n8nUrl, {
                    event_id: event.id,
                    user_id: userId,
                    event_date: event.event_date.toISOString(),
                    event_name: event.name,
                }, { timeout: 30000 });

                console.log('[Events RSVP] Respuesta n8n:', JSON.stringify(data).slice(0, 500));

                conflicts = {
                    has_conflicts: data.has_conflicts || false,
                    conflicts: data.conflicts || [],
                    recommendations: data.recommendations || [],
                    suggested_times: data.suggested_times || [],
                    summary: data.summary || 'Análisis completado',
                };
            } catch (err) {
                console.error('[Events RSVP] Error al analizar conflictos:', err.message);
                if (err.code) console.error('[Events RSVP] Error code:', err.code);
                if (err.response) console.error('[Events RSVP] Response status:', err.response.status, err.response.data);
            }

            return { ...summary, conflicts };
        }

        return summary;
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

    // ── Analizar conflictos de un evento existente ──
    async checkConflicts(eventId: string, userId: string) {
        const event = await this.eventRepo.findOne({ where: { id: eventId } });
        if (!event) throw new NotFoundException('Evento no encontrado');

        try {
            const n8nUrl = process.env.N8N_WEBHOOK_CALENDAR_CONFLICTS
                || 'http://localhost:5678/webhook/calendar-conflict';

            console.log(`[Events] checkConflicts event=${eventId} url=${n8nUrl}`);

            const { data } = await axios.post(n8nUrl, {
                event_id: event.id,
                user_id: userId,
                event_date: event.event_date.toISOString(),
                event_name: event.name,
            }, { timeout: 30000 });

            console.log(`[Events] checkConflicts response:`, JSON.stringify(data).slice(0, 300));

            return {
                event_id: eventId,
                has_conflicts: data.has_conflicts || false,
                conflicts: data.conflicts || [],
                recommendations: data.recommendations || [],
                suggested_times: data.suggested_times || [],
                summary: data.summary || 'Análisis completado',
            };
        } catch (err) {
            console.error('[Events] Error checkConflicts:', err.message);
            if (err.code) console.error('[Events] Error code:', err.code);
            if (err.response) console.error('[Events] Response:', err.response.status, err.response.data);
            return {
                event_id: eventId,
                has_conflicts: false,
                conflicts: [],
                recommendations: [],
                suggested_times: [],
                summary: 'No se pudo conectar con el asistente IA',
            };
        }
    }

    // ── Analizar conflictos de varios eventos en lote ──
    async checkBulkConflicts(eventIds: string[], userId: string) {
        const results = await Promise.all(
            eventIds.map(id => this.checkConflicts(id, userId)),
        );
        return results;
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