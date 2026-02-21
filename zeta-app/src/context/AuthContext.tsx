// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Storage } from '../services/storage';
import api from '../services/api';
import { SocketService } from '../services/socket';

interface User {
    id: string;
    name: string;
    email: string;
    photo: string | null;
    year: number;
    privacy: string;
    academic_offer_id: string | null;
    interests: any[];
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    loading: boolean;
    isOnboardingComplete: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // ── Onboarding completo? ──
    const isOnboardingComplete = !!(
        (user?.academic_offer_id || (user as any)?.academicOffer) &&
        user?.interests &&
        user.interests.length > 0
    );

    // ── Restaurar sesión al arrancar ──
    useEffect(() => {
        (async () => {
            try {
                const savedToken = await Storage.getToken();
                const savedUser = await Storage.getUser();
                if (savedToken && savedUser) {
                    setToken(savedToken);
                    setUser(savedUser);
                    api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
                    try { await SocketService.connect(); } catch (e) { console.warn('Socket reconnect:', e); }
                }
            } catch (e) {
                console.error('Error restaurando sesión:', e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // ── Login ──
    const login = async (email: string, password: string) => {
        const { data } = await api.post('/auth/login', { email, password });
        await persistSession(data.access_token, data.user);
    };

    // ── Register ──
    const register = async (name: string, email: string, password: string) => {
        const { data } = await api.post('/auth/register', { name, email, password });
        await persistSession(data.access_token, data.user);
    };

    // ── Guardar sesión ──
    const persistSession = async (jwt: string, userData: User) => {
        setToken(jwt);
        setUser(userData);
        api.defaults.headers.common['Authorization'] = `Bearer ${jwt}`;
        await Storage.setToken(jwt);
        await Storage.setUser(userData);
        try { await SocketService.connect(); } catch (e) { console.warn('Socket connect error:', e); }
    };

    // ── Refrescar usuario (tras completar onboarding) ──
    const refreshUser = async () => {
        try {
            const { data } = await api.get('/users/me');
            setUser(data);
            await Storage.setUser(data);
        } catch (err) {
            console.error('Error refrescando usuario:', err);
        }
    };

    // ── Logout ──
    const logout = async () => {
        SocketService.disconnect();
        setToken(null);
        setUser(null);
        delete api.defaults.headers.common['Authorization'];
        await Storage.clear();
    };

    return (
        <AuthContext.Provider
            value={{ user, token, loading, isOnboardingComplete, login, register, logout, refreshUser }}
        >
            {children}
        </AuthContext.Provider>
    );
}