import {
    Injectable, NotFoundException, ForbiddenException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Event } from './entities/event.entity';
import { GroupMember } from '../groups/entities/group-member.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class EventsService {
    constructor(
        @InjectRepository(Event)
        private readonly eventRepo: Repository<Event>,
        @InjectRepository(GroupMember)
        private readonly memberRepo: Repository<GroupMember>,
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

    // ── Mis eventos próximos (de todos mis grupos) ──
    async findMyUpcoming(userId: string) {
        // Obtener grupos del usuario
        const memberships = await this.memberRepo.find({
            where: { user_id: userId },
        });

        const groupIds = memberships.map((m) => m.group_id);
        if (groupIds.length === 0) return [];

        return this.eventRepo
            .createQueryBuilder('event')
            .leftJoinAndSelect('event.group', 'group')
            .leftJoinAndSelect('event.creator', 'creator')
            .where('event.group_id IN (:...groupIds)', { groupIds })
            .andWhere('event.event_date >= :now', { now: new Date() })
            .orderBy('event.event_date', 'ASC')
            .take(20)
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

        await this.eventRepo.remove(event);
        return { message: 'Evento eliminado' };
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