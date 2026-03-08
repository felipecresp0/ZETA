// src/services/tasksService.ts
import api from './api';

export interface Task {
    id: string;
    title: string;
    description?: string;
    subject?: string;
    due_date: string;
    estimated_hours?: number;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    status: 'pending' | 'in_progress' | 'completed';
    user_id: string;
    group_id?: string;
    ai_pioritized: boolean;
    group?: { id: string; name: string };
    created_at: string;
}

export interface CreateTaskPayload {
    title: string;
    description?: string;
    subject?: string;
    due_date: string;
    estimated_hours?: number;
    priority?: string;
    group_id?: string;
}

export interface UpdateTaskPayload {
    title?: string;
    description?: string;
    subject?: string;
    due_date?: string;
    estimated_hours?: number;
    priority?: string;
    status?: string;
}

const tasksService = {
    getMyTasks: async (): Promise<Task[]> => {
        const { data } = await api.get('/tasks/me');
        return data;
    },

    create: async (payload: CreateTaskPayload): Promise<Task> => {
        const { data } = await api.post('/tasks', payload);
        return data;
    },

    update: async (taskId: string, payload: UpdateTaskPayload): Promise<Task> => {
        const { data } = await api.patch(`/tasks/${taskId}`, payload);
        return data;
    },

    remove: async (taskId: string): Promise<void> => {
        await api.delete(`/tasks/${taskId}`);
    },
};

export default tasksService;
