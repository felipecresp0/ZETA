import {
    Injectable, NotFoundException, ForbiddenException,
    ConflictException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group } from './entities/group.entity';
import { GroupMember } from './entities/group-member.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

@Injectable()
export class GroupsService {
    constructor(
        @InjectRepository(Group)
        private readonly groupRepo: Repository<Group>,
        @InjectRepository(GroupMember)
        private readonly memberRepo: Repository<GroupMember>,
        @InjectRepository(Conversation)
        private readonly convRepo: Repository<Conversation>,
    ) { }

    // ── Crear grupo + unir al creador como admin + crear conversación ──
    async create(dto: CreateGroupDto, userId: string) {
        // 1. Crear grupo
        const group = this.groupRepo.create({
            ...dto,
            creator_id: userId,
        });
        const saved = await this.groupRepo.save(group);

        // 2. Añadir creador como admin
        const member = this.memberRepo.create({
            user_id: userId,
            group_id: saved.id,
            role: 'admin',
        });
        await this.memberRepo.save(member);

        // 3. Crear conversación de grupo automáticamente
        const conversation = this.convRepo.create({
            type: 'group',
            group_id: saved.id,
            participant_ids: [userId],
        });
        await this.convRepo.save(conversation);

        return this.findOne(saved.id);
    }

    // ── Listar grupos del usuario ──
    async findMyGroups(userId: string) {
        const memberships = await this.memberRepo.find({
            where: { user_id: userId },
            relations: [
                'group',
                'group.members',
                'group.members.user',
            ],
        });

        return memberships.map((m) => ({
            ...m.group,
            my_role: m.role,
            member_count: m.group.members?.length || 0,
        }));
    }

    // ── Buscar grupos públicos (para explorar) ──
    async findPublicGroups(userId: string) {
        const groups = await this.groupRepo.find({
            where: { privacy: 'public' },
            relations: ['members', 'creator'],
            order: { created_at: 'DESC' },
            take: 50,
        });

        // Marcar si el usuario ya es miembro
        return groups.map((g) => ({
            id: g.id,
            name: g.name,
            description: g.description,
            type: g.type,
            privacy: g.privacy,
            creator: { id: g.creator?.id, name: g.creator?.name },
            member_count: g.members?.length || 0,
            is_member: g.members?.some((m) => m.user_id === userId) || false,
            created_at: g.created_at,
        }));
    }

    // ── Detalle de un grupo ──
    async findOne(groupId: string) {
        const group = await this.groupRepo.findOne({
            where: { id: groupId },
            relations: [
                'members',
                'members.user',
                'events',
                'creator',
            ],
        });

        if (!group) throw new NotFoundException('Grupo no encontrado');

        return {
            ...group,
            member_count: group.members?.length || 0,
            members: group.members?.map((m) => ({
                id: m.user.id,
                name: m.user.name,
                photo: m.user.photo,
                role: m.role,
                joined_at: m.joined_at,
            })),
        };
    }

    // ── Actualizar grupo (solo admin) ──
    async update(groupId: string, dto: UpdateGroupDto, userId: string) {
        await this.assertAdmin(groupId, userId);

        await this.groupRepo.update(groupId, dto);
        return this.findOne(groupId);
    }

    // ── Unirse a un grupo ──
    async join(groupId: string, userId: string) {
        const group = await this.groupRepo.findOne({ where: { id: groupId } });
        if (!group) throw new NotFoundException('Grupo no encontrado');

        // Verificar si ya es miembro
        const existing = await this.memberRepo.findOne({
            where: { group_id: groupId, user_id: userId },
        });
        if (existing) throw new ConflictException('Ya eres miembro de este grupo');

        // Añadir como miembro
        const member = this.memberRepo.create({
            user_id: userId,
            group_id: groupId,
            role: 'member',
        });
        await this.memberRepo.save(member);

        // Añadir a la conversación del grupo
        const conv = await this.convRepo.findOne({
            where: { group_id: groupId },
        });
        if (conv) {
            const ids = conv.participant_ids || [];
            if (!ids.includes(userId)) {
                conv.participant_ids = [...ids, userId];
                await this.convRepo.save(conv);
            }
        }

        return { message: 'Te has unido al grupo', group_id: groupId };
    }

    // ── Salir de un grupo ──
    async leave(groupId: string, userId: string) {
        const member = await this.memberRepo.findOne({
            where: { group_id: groupId, user_id: userId },
        });

        if (!member) throw new NotFoundException('No eres miembro de este grupo');

        // El creador no puede salir (debe transferir o eliminar)
        const group = await this.groupRepo.findOne({ where: { id: groupId } });
        if (group?.creator_id === userId) {
            throw new ForbiddenException('El creador no puede abandonar el grupo. Elimínalo o transfiere la propiedad.');
        }

        await this.memberRepo.remove(member);

        // Quitar de la conversación
        const conv = await this.convRepo.findOne({
            where: { group_id: groupId },
        });
        if (conv) {
            conv.participant_ids = (conv.participant_ids || []).filter((id) => id !== userId);
            await this.convRepo.save(conv);
        }

        return { message: 'Has salido del grupo' };
    }

    // ── Eliminar grupo (solo creador) ──
    async remove(groupId: string, userId: string) {
        const group = await this.groupRepo.findOne({ where: { id: groupId } });
        if (!group) throw new NotFoundException('Grupo no encontrado');

        if (group.creator_id !== userId) {
            throw new ForbiddenException('Solo el creador puede eliminar el grupo');
        }

        await this.groupRepo.remove(group);
        return { message: 'Grupo eliminado' };
    }

    // ── Helper: verificar que el usuario es admin del grupo ──
    private async assertAdmin(groupId: string, userId: string) {
        const member = await this.memberRepo.findOne({
            where: { group_id: groupId, user_id: userId },
        });

        if (!member) throw new NotFoundException('No eres miembro de este grupo');
        if (member.role !== 'admin') {
            throw new ForbiddenException('Solo los administradores pueden hacer esto');
        }
    }
}