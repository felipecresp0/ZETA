// src/services/socket.ts
// Cliente socket.io que conecta con el ChatGateway de NestJS
// Namespace: /chat — requiere JWT en auth.token
import { io, Socket } from 'socket.io-client';
import { Storage } from './storage';

// ⚠️ Misma IP que api.ts — sin /api, puerto directo
const SOCKET_URL = 'http://192.168.1.60:3000/chat';

let socket: Socket | null = null;

// ── Tipos de eventos (match exacto con chat.gateway.ts) ──
export interface NewMessage {
    _id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    type: 'text' | 'image' | 'file';
    attachment_url: string | null;
    read_by: Record<string, boolean>;
    createdAt: string;
    updatedAt: string;
}

export interface ConversationUpdated {
    conversation_id: string;
    last_message_preview: string;
    last_message_at: string;
}

export interface TypingUpdate {
    conversation_id: string;
    user_id: string;
    is_typing: boolean;
}

export interface MessagesRead {
    conversation_id: string;
    read_by: string;
}

// ══════════════════════════════════════════
//  CONEXIÓN
// ══════════════════════════════════════════
export const SocketService = {
    // Conectar — llamar después de login/restaurar sesión
    connect: async (): Promise<Socket> => {
        // Si ya hay conexión activa, reutilizar
        if (socket?.connected) return socket;

        const token = await Storage.getToken();
        if (!token) throw new Error('No hay token para conectar WebSocket');

        socket = io(SOCKET_URL, {
            auth: { token },
            transports: ['websocket'],   // Forzar WS, no polling (más rápido)
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 10000,
        });

        // Logs de desarrollo
        socket.on('connect', () => {
            console.log('[Socket] Conectado:', socket?.id);
        });

        socket.on('disconnect', (reason) => {
            console.log('[Socket] Desconectado:', reason);
        });

        socket.on('connect_error', (err) => {
            console.error('[Socket] Error conexión:', err.message);
        });

        return socket;
    },

    // Desconectar — llamar en logout
    disconnect: () => {
        if (socket) {
            socket.removeAllListeners();
            socket.disconnect();
            socket = null;
        }
    },

    // Obtener instancia actual
    getSocket: (): Socket | null => socket,

    // ══════════════════════════════════════════
    //  EMITIR EVENTOS (cliente → servidor)
    // ══════════════════════════════════════════

    // Enviar mensaje
    sendMessage: (data: {
        conversation_id: string;
        content: string;
        type?: string;
        attachment_url?: string;
    }) => {
        socket?.emit('message:send', data);
    },

    // Typing
    startTyping: (conversation_id: string) => {
        socket?.emit('typing:start', { conversation_id });
    },

    stopTyping: (conversation_id: string) => {
        socket?.emit('typing:stop', { conversation_id });
    },

    // Marcar como leído
    markAsRead: (conversation_id: string) => {
        socket?.emit('messages:read', { conversation_id });
    },

    // Unirse a conversación nueva
    joinConversation: (conversation_id: string) => {
        socket?.emit('conversation:join', { conversation_id });
    },

    // ══════════════════════════════════════════
    //  ESCUCHAR EVENTOS (servidor → cliente)
    // ══════════════════════════════════════════

    // Nuevo mensaje en cualquier conversación
    onNewMessage: (cb: (msg: NewMessage) => void) => {
        socket?.on('message:new', cb);
        return () => { socket?.off('message:new', cb); };
    },

    // Conversación actualizada (preview + timestamp)
    onConversationUpdated: (cb: (data: ConversationUpdated) => void) => {
        socket?.on('conversation:updated', cb);
        return () => { socket?.off('conversation:updated', cb); };
    },

    // Typing indicator
    onTypingUpdate: (cb: (data: TypingUpdate) => void) => {
        socket?.on('typing:update', cb);
        return () => { socket?.off('typing:update', cb); };
    },

    // Mensajes leídos
    onMessagesRead: (cb: (data: MessagesRead) => void) => {
        socket?.on('messages:read', cb);
        return () => { socket?.off('messages:read', cb); };
    },

    // Usuario online/offline
    onUserOnline: (cb: (data: { userId: string }) => void) => {
        socket?.on('user:online', cb);
        return () => { socket?.off('user:online', cb); };
    },

    onUserOffline: (cb: (data: { userId: string }) => void) => {
        socket?.on('user:offline', cb);
        return () => { socket?.off('user:offline', cb); };
    },

    // Error de mensaje
    onMessageError: (cb: (data: { error: string }) => void) => {
        socket?.on('message:error', cb);
        return () => { socket?.off('message:error', cb); };
    },
};