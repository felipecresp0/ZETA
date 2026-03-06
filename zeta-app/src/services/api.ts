import axios from 'axios';
import { Storage } from './storage';
import { API_BASE_URL } from '../config/network';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
});

// Interceptor: añade token a cada request automáticamente
api.interceptors.request.use(async (config) => {
    const token = await Storage.getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Interceptor: si 401, limpiar token (sesión expirada)
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            await Storage.clear();
            // El AuthContext detectará que no hay token y mostrará login
        }
        return Promise.reject(error);
    },
);

export default api;