// src/services/groupService.ts
// Servicio para comunicación con la API de grupos del backend
import api from './api';

// ── Tipos ──
export interface GroupMember {
    id: string;
    user_id: string;
    role: 'admin' | 'member';
    joined_at: string;
    user: {
        id: string;
        name: string;
        email: string;
        photo: string | null;
    };
}

export interface Group {
    id: string;
    name: string;
    description: string | null;
    type: 'general' | 'carrera' | 'interes' | 'estudio';
    privacy: 'public' | 'university' | 'private';
    creator_id: string;
    created_at: string;
    members: GroupMember[];
    member_count?: number;
    is_member?: boolean;
    my_role?: 'admin' | 'member' | null;
}

export interface CreateGroupDto {
    name: string;
    description?: string;
    type: 'general' | 'carrera' | 'interes' | 'estudio';
    privacy: 'public' | 'university' | 'private';
}

// ── API Calls ──

/** Listar grupos públicos para explorar */
export const getGroups = async (): Promise<Group[]> => {
    const { data } = await api.get('/groups/explore');
    return data;
};

/** Listar solo mis grupos */
export const getMyGroups = async (): Promise<Group[]> => {
    const { data } = await api.get('/groups/me');
    return data;
};

/** Detalle de un grupo */
export const getGroupById = async (id: string): Promise<Group> => {
    const { data } = await api.get(`/groups/${id}`);
    return data;
};

/** Crear un grupo nuevo */
export const createGroup = async (dto: CreateGroupDto): Promise<Group> => {
    const { data } = await api.post('/groups', dto);
    return data;
};

/** Unirse a un grupo */
export const joinGroup = async (groupId: string): Promise<void> => {
    await api.post(`/groups/${groupId}/join`);
};

/** Salir de un grupo */
export const leaveGroup = async (groupId: string): Promise<void> => {
    await api.post(`/groups/${groupId}/leave`);
};

/** Obtener miembros de un grupo (extraídos del detalle) */
export const getGroupMembers = async (groupId: string): Promise<GroupMember[]> => {
    const group = await getGroupById(groupId);
    return group.members || [];
};