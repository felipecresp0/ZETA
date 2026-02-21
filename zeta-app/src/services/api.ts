import axios from 'axios';
import { Storage } from './storage';

// ⚠️ Cambiar a la IP de tu máquina para Expo Go
// En Windows: ipconfig → IPv4 de tu red WiFi
// Ejemplo: 192.168.1.45
const BASE_URL = 'http://192.168.1.60:3000/api';

const api = axios.create({
    baseURL: BASE_URL,
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