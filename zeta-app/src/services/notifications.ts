// src/services/notifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import api from './api';

// Configurar cómo se muestran las notificaciones cuando la app está abierta
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export async function registerForPushNotifications(): Promise<string | null> {
    if (!Device.isDevice) {
        console.log('Push notifications solo funcionan en dispositivos físicos');
        return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.log('Permisos de notificación denegados');
        return null;
    }

    // Obtener el Expo Push Token
    const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'tu-project-id-de-expo', // Lo sacas de app.json o expo.dev
    });

    const pushToken = tokenData.data;

    // Enviar token al backend para guardarlo
    try {
        await api.patch('/users/me/push-token', { push_token: pushToken });
    } catch (err) {
        console.error('Error guardando push token:', err);
    }

    // Android necesita canal de notificación
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
        });
    }

    return pushToken;
}