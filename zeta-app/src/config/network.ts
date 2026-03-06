// src/config/network.ts
// Detecta automáticamente la IP del servidor de desarrollo
// para que no haya que cambiarla al moverse entre redes.

import { Platform } from 'react-native';
import Constants from 'expo-constants';

const PORT = 3000;

function getDevServerHost(): string {
    // Web → siempre localhost (front y back en la misma máquina)
    if (Platform.OS === 'web') return 'localhost';

    // Móvil → Expo ya conoce la IP de tu PC (la usa para el bundler)
    const debuggerHost =
        Constants.expoConfig?.hostUri ?? // SDK 49+
        (Constants as any).manifest?.debuggerHost; // SDK legacy

    if (debuggerHost) {
        // debuggerHost viene como "192.168.x.x:8081", quitamos el puerto
        return debuggerHost.split(':')[0];
    }

    // Fallback: si nada funciona, usar localhost
    console.warn('[Network] No se pudo detectar IP — usando localhost');
    return 'localhost';
}

const HOST = getDevServerHost();

export const API_BASE_URL = `http://${HOST}:${PORT}/api`;
export const SOCKET_URL = `http://${HOST}:${PORT}/chat`;
