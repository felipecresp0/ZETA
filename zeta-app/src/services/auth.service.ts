import api from './api';
import { Storage } from './storage';

export const AuthService = {
    async register(name: string, email: string, password: string) {
        const { data } = await api.post('/auth/register', { name, email, password });
        await Storage.setToken(data.access_token);
        await Storage.setUser(data.user);
        return data;
    },

    async login(email: string, password: string) {
        const { data } = await api.post('/auth/login', { email, password });
        await Storage.setToken(data.access_token);
        await Storage.setUser(data.user);
        return data;
    },

    async getProfile() {
        const { data } = await api.get('/users/me');
        await Storage.setUser(data);
        return data;
    },

    async updateProfile(updates: any) {
        const { data } = await api.patch('/users/me', updates);
        await Storage.setUser(data);
        return data;
    },

    async logout() {
        await Storage.clear();
    },
};