// src/services/storage.ts
// Reemplaza expo-secure-store con AsyncStorage (compatible con Expo Go)
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'zeta_token';
const USER_KEY = 'zeta_user';

export const Storage = {
    async getToken(): Promise<string | null> {
        return AsyncStorage.getItem(TOKEN_KEY);
    },

    async setToken(token: string): Promise<void> {
        await AsyncStorage.setItem(TOKEN_KEY, token);
    },

    async removeToken(): Promise<void> {
        await AsyncStorage.removeItem(TOKEN_KEY);
    },

    async getUser(): Promise<any | null> {
        const json = await AsyncStorage.getItem(USER_KEY);
        return json ? JSON.parse(json) : null;
    },

    async setUser(user: any): Promise<void> {
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    },

    async removeUser(): Promise<void> {
        await AsyncStorage.removeItem(USER_KEY);
    },

    async clear(): Promise<void> {
        await AsyncStorage.removeItem(TOKEN_KEY);
        await AsyncStorage.removeItem(USER_KEY);
    },
};