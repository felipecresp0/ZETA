// =============================================
// src/services/eventsService.ts
// Servicio para consumir la API de Events de Sergio
// =============================================
import api from './api';  // Tu instancia de axios con baseURL + interceptor JWT

// ── Tipos (espejo del backend) ──
export interface ZetaEvent {
    id: string;
    name: string;
    description?: string;
    event_date: string;        // ISO string
    location?: string;
    group_id: string;
    creator_id: string;
    group?: { id: string; name: string };
    creator?: { id: string; name: string; photo?: string };
    created_at: string;
}

export interface CreateEventPayload {
    name: string;
    description?: string;
    event_date: string;        // ISO string — "2026-03-01T18:00:00Z"
    location?: string;
    group_id: string;
}

export interface UpdateEventPayload {
    name?: string;
    description?: string;
    event_date?: string;
    location?: string;
}

// ── API calls ──
const eventsService = {
    /** Mis eventos próximos (de todos mis grupos) */
    getUpcoming: async (): Promise<ZetaEvent[]> => {
        const { data } = await api.get('/events/upcoming');
        return data;
    },

    /** Eventos de un grupo específico */
    getByGroup: async (groupId: string): Promise<ZetaEvent[]> => {
        const { data } = await api.get(`/events/group/${groupId}`);
        return data;
    },

    /** Detalle de un evento */
    getById: async (eventId: string): Promise<ZetaEvent> => {
        const { data } = await api.get(`/events/${eventId}`);
        return data;
    },

    /** Crear evento (requiere ser miembro del grupo) */
    create: async (payload: CreateEventPayload): Promise<ZetaEvent> => {
        const { data } = await api.post('/events', payload);
        return data;
    },

    /** Actualizar evento */
    update: async (eventId: string, payload: UpdateEventPayload): Promise<ZetaEvent> => {
        const { data } = await api.patch(`/events/${eventId}`, payload);
        return data;
    },

    /** Eliminar evento */
    remove: async (eventId: string): Promise<void> => {
        await api.delete(`/events/${eventId}`);
    },
};

export default eventsService;