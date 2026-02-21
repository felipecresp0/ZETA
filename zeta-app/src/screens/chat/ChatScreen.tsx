// src/screens/chat/ChatScreen.tsx
// Pantalla de mensajes — conectada al WebSocket de Sergio
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Keyboard,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import api from '../../services/api';
import {
    SocketService,
    NewMessage,
    TypingUpdate,
} from '../../services/socket';

// ── Tipo de parámetros de navegación ──
type ChatRouteParams = {
    ChatDetail: {
        conversationId: string;
        title: string;
        type: 'direct' | 'group';
        participantIds: string[];
    };
};

// ── Tipo de mensaje (match con MongoDB response) ──
interface Message {
    _id: string | { buffer: { type: string; data: number[] } };
    conversation_id: string;
    sender_id: string;
    content: string;
    type: 'text' | 'image' | 'file';
    attachment_url: string | null;
    read_by: Record<string, boolean>;
    createdAt: string;
    updatedAt: string;
    senderName?: string;
}

// Extraer un string ID usable del _id de MongoDB
const getMessageId = (msg: Message): string => {
    if (typeof msg._id === 'string') return msg._id;
    if (msg._id?.buffer?.data) {
        return msg._id.buffer.data.map((b: number) => b.toString(16).padStart(2, '0')).join('');
    }
    return `${msg.sender_id}-${msg.createdAt}`;
};

// Cache simple de nombres de usuario para chats grupales
const userNameCache = new Map<string, string>();

export const ChatScreen: React.FC = () => {
    const route = useRoute<RouteProp<ChatRouteParams, 'ChatDetail'>>();
    const nav = useNavigation();
    const { user } = useAuth();

    const { conversationId, title, type, participantIds } = route.params;

    // ── Estado ──
    // IMPORTANTE: messages se guarda en orden MÁS NUEVO PRIMERO
    // porque FlatList inverted renderiza desde abajo
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [typingUsers, setTypingUsers] = useState<string[]>([]);

    const flatListRef = useRef<FlatList>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isTypingRef = useRef(false);

    // ── Cargar historial de mensajes ──
    useEffect(() => {
        loadMessages();
    }, [conversationId]);

    const loadMessages = async () => {
        try {
            const { data } = await api.get(
                `/conversations/${conversationId}/messages`
            );

            // Enriquecer con nombres si es grupo
            let enriched = data;
            if (type === 'group') {
                enriched = await enrichWithNames(data);
            }

            // La API devuelve más antiguo primero (cronológico)
            // inverted FlatList necesita más nuevo primero → reverse
            setMessages(enriched.reverse());

            // Marcar como leído
            SocketService.markAsRead(conversationId);
        } catch (err) {
            console.error('Error cargando mensajes:', err);
        } finally {
            setLoading(false);
        }
    };

    // ── Obtener nombres de usuarios para mensajes de grupo ──
    const enrichWithNames = async (msgs: Message[]): Promise<Message[]> => {
        const uniqueIds = [...new Set(msgs.map((m) => m.sender_id))];
        const uncached = uniqueIds.filter((id) => !userNameCache.has(id));
        await Promise.all(
            uncached.map(async (id) => {
                try {
                    const { data } = await api.get(`/users/${id}`);
                    userNameCache.set(id, data.name);
                } catch {
                    userNameCache.set(id, 'Usuario');
                }
            })
        );
        return msgs.map((m) => ({
            ...m,
            senderName: userNameCache.get(m.sender_id) || 'Usuario',
        }));
    };

    // ── WebSocket: escuchar mensajes nuevos ──
    useEffect(() => {
        const unsubMsg = SocketService.onNewMessage((msg: NewMessage) => {
            if (msg.conversation_id !== conversationId) return;

            const enriched: Message = {
                ...msg,
                senderName: userNameCache.get(msg.sender_id) || undefined,
            };

            // Añadir al INICIO del array (más nuevo primero para inverted)
            setMessages((prev) => [enriched, ...prev]);

            if (msg.sender_id !== user?.id) {
                SocketService.markAsRead(conversationId);
            }
        });

        const unsubTyping = SocketService.onTypingUpdate((data: TypingUpdate) => {
            if (data.conversation_id !== conversationId) return;
            setTypingUsers((prev) => {
                if (data.is_typing) {
                    return prev.includes(data.user_id) ? prev : [...prev, data.user_id];
                }
                return prev.filter((id) => id !== data.user_id);
            });
        });

        const unsubRead = SocketService.onMessagesRead((data) => {
            if (data.conversation_id !== conversationId) return;
            setMessages((prev) =>
                prev.map((m) => ({
                    ...m,
                    read_by: { ...m.read_by, [data.read_by]: true },
                }))
            );
        });

        return () => {
            unsubMsg?.();
            unsubTyping?.();
            unsubRead?.();
        };
    }, [conversationId, user?.id]);

    // ── Enviar mensaje ──
    const handleSend = () => {
        const text = inputText.trim();
        if (!text || sending) return;

        SocketService.sendMessage({
            conversation_id: conversationId,
            content: text,
            type: 'text',
        });

        setInputText('');

        if (isTypingRef.current) {
            SocketService.stopTyping(conversationId);
            isTypingRef.current = false;
        }

        Keyboard.dismiss();
    };

    // ── Typing indicator con debounce ──
    const handleTextChange = (text: string) => {
        setInputText(text);

        if (text.length > 0 && !isTypingRef.current) {
            isTypingRef.current = true;
            SocketService.startTyping(conversationId);
        }

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        typingTimeoutRef.current = setTimeout(() => {
            if (isTypingRef.current) {
                SocketService.stopTyping(conversationId);
                isTypingRef.current = false;
            }
        }, 2000);

        if (text.length === 0 && isTypingRef.current) {
            SocketService.stopTyping(conversationId);
            isTypingRef.current = false;
        }
    };

    // ── Limpiar typing al salir ──
    useEffect(() => {
        return () => {
            if (isTypingRef.current) {
                SocketService.stopTyping(conversationId);
            }
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        };
    }, [conversationId]);

    // ── Formatear hora del mensaje ──
    const formatMsgTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    };

    const getInitials = (name: string) => {
        const parts = name.split(' ');
        return parts.length > 1
            ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
            : name.substring(0, 2).toUpperCase();
    };

    // ── INVERTED: el index 0 es el más nuevo (abajo en pantalla)
    // Para comparar "anterior visualmente" hay que mirar index + 1
    const isFirstInGroup = (index: number): boolean => {
        if (index === messages.length - 1) return true; // último (más antiguo) siempre es primero
        return messages[index].sender_id !== messages[index + 1].sender_id;
    };

    const shouldShowDate = (index: number): boolean => {
        if (index === messages.length - 1) return true; // el más antiguo siempre muestra fecha
        const curr = new Date(messages[index].createdAt).toDateString();
        const next = new Date(messages[index + 1].createdAt).toDateString();
        return curr !== next;
    };

    const formatDateSeparator = (dateStr: string) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        const days = Math.floor(diff / 86400000);

        if (days === 0) return 'Hoy';
        if (days === 1) return 'Ayer';
        return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
    };

    // ── Render mensaje ──
    const renderMessage = ({ item, index }: { item: Message; index: number }) => {
        const isMine = item.sender_id === user?.id;
        const firstInGroup = isFirstInGroup(index);
        const showDate = shouldShowDate(index);

        return (
            <View>
                {/* Separador de fecha — en inverted va DEBAJO del mensaje */}
                {showDate && (
                    <View style={styles.dateSeparator}>
                        <Text style={styles.dateSeparatorText}>
                            {formatDateSeparator(item.createdAt)}
                        </Text>
                    </View>
                )}

                <View
                    style={[
                        styles.msgRow,
                        isMine ? styles.msgRowMine : styles.msgRowOther,
                        !firstInGroup && { marginTop: 2 },
                    ]}
                >
                    {!isMine && type === 'group' && firstInGroup ? (
                        <View style={styles.msgAvatar}>
                            <Text style={styles.msgAvatarText}>
                                {getInitials(item.senderName || 'U')}
                            </Text>
                        </View>
                    ) : !isMine && type === 'group' ? (
                        <View style={styles.msgAvatarPlaceholder} />
                    ) : null}

                    <View
                        style={[
                            styles.bubble,
                            isMine ? styles.bubbleMine : styles.bubbleOther,
                            firstInGroup && !isMine && styles.bubbleFirstOther,
                            firstInGroup && isMine && styles.bubbleFirstMine,
                        ]}
                    >
                        {!isMine && type === 'group' && firstInGroup && (
                            <Text style={styles.senderName}>{item.senderName}</Text>
                        )}

                        <Text style={[styles.msgText, isMine ? styles.msgTextMine : styles.msgTextOther]}>
                            {item.content}
                        </Text>

                        <View style={styles.msgMeta}>
                            <Text style={[styles.msgTime, isMine && styles.msgTimeMine]}>
                                {formatMsgTime(item.createdAt)}
                            </Text>
                            {isMine && (
                                <Feather
                                    name="check"
                                    size={13}
                                    color={
                                        Object.values(item.read_by || {}).filter(Boolean).length > 1
                                            ? '#34D399'
                                            : 'rgba(255,255,255,0.5)'
                                    }
                                    style={{ marginLeft: 4 }}
                                />
                            )}
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            {/* ── Header ── */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
                    <Feather name="arrow-left" size={24} color={Colors.text} />
                </TouchableOpacity>
                <View style={[styles.headerAvatar, type === 'group' && styles.headerAvatarGroup]}>
                    {type === 'group' ? (
                        <Feather name="users" size={16} color={Colors.white} />
                    ) : (
                        <Text style={styles.headerAvatarText}>{getInitials(title)}</Text>
                    )}
                </View>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
                    {typingUsers.length > 0 ? (
                        <Text style={styles.headerTyping}>escribiendo...</Text>
                    ) : (
                        <Text style={styles.headerSub}>
                            {type === 'group' ? `${participantIds.length} miembros` : 'en línea'}
                        </Text>
                    )}
                </View>
                <TouchableOpacity style={styles.headerAction}>
                    <Feather name="more-vertical" size={22} color={Colors.text} />
                </TouchableOpacity>
            </View>

            {/* ── Mensajes (INVERTED) ── */}
            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => getMessageId(item)}
                renderItem={renderMessage}
                contentContainerStyle={styles.messagesList}
                showsVerticalScrollIndicator={false}
                inverted
            />

            {/* ── Typing indicator ── */}
            {typingUsers.length > 0 && (
                <View style={styles.typingBar}>
                    <View style={styles.typingDots}>
                        <View style={[styles.typingDot, styles.typingDot1]} />
                        <View style={[styles.typingDot, styles.typingDot2]} />
                        <View style={[styles.typingDot, styles.typingDot3]} />
                    </View>
                    <Text style={styles.typingText}>
                        {typingUsers.length === 1 ? 'Alguien está escribiendo...' : 'Varios escribiendo...'}
                    </Text>
                </View>
            )}

            {/* ── Input bar ── */}
            <View style={styles.inputBar}>
                <TouchableOpacity style={styles.attachButton}>
                    <Feather name="paperclip" size={22} color={Colors.gray} />
                </TouchableOpacity>

                <TextInput
                    style={styles.textInput}
                    placeholder="Mensaje..."
                    placeholderTextColor={Colors.gray}
                    value={inputText}
                    onChangeText={handleTextChange}
                    multiline
                    maxLength={2000}
                />

                <TouchableOpacity style={styles.emojiButton}>
                    <Feather name="smile" size={22} color={Colors.gray} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                    onPress={handleSend}
                    disabled={!inputText.trim()}
                    activeOpacity={0.7}
                >
                    <Feather name="send" size={20} color={Colors.white} />
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
};

// ══════════════════════════════════════════
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingTop: 50,
        paddingBottom: 12,
        backgroundColor: Colors.white,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        gap: 10,
    },
    backBtn: { padding: 4 },
    headerAvatar: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: Colors.secondary,
        justifyContent: 'center', alignItems: 'center',
    },
    headerAvatarGroup: { backgroundColor: Colors.dark },
    headerAvatarText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
    headerInfo: { flex: 1 },
    headerTitle: { fontSize: 17, fontWeight: '600', color: Colors.text },
    headerSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
    headerTyping: { fontSize: 12, color: Colors.primary, fontWeight: '500', marginTop: 1 },
    headerAction: { padding: 4 },
    messagesList: { paddingHorizontal: 12, paddingVertical: 8 },
    dateSeparator: { alignItems: 'center', marginVertical: 12 },
    dateSeparatorText: {
        fontSize: 12, color: Colors.gray, fontWeight: '500',
        backgroundColor: Colors.background,
        paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, overflow: 'hidden',
    },
    msgRow: { flexDirection: 'row', marginTop: 8, maxWidth: '80%' },
    msgRowMine: { alignSelf: 'flex-end' },
    msgRowOther: { alignSelf: 'flex-start' },
    msgAvatar: {
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: Colors.gray,
        justifyContent: 'center', alignItems: 'center',
        marginRight: 6, marginTop: 2,
    },
    msgAvatarText: { color: Colors.white, fontSize: 10, fontWeight: '700' },
    msgAvatarPlaceholder: { width: 34 },
    bubble: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, maxWidth: '100%' },
    bubbleMine: { backgroundColor: Colors.bubbleMine, borderBottomRightRadius: 4 },
    bubbleOther: { backgroundColor: Colors.bubbleOther, borderBottomLeftRadius: 4 },
    bubbleFirstMine: { borderTopRightRadius: 18, borderBottomRightRadius: 4 },
    bubbleFirstOther: { borderTopLeftRadius: 18, borderBottomLeftRadius: 4 },
    senderName: { fontSize: 12, fontWeight: '600', color: Colors.primary, marginBottom: 2 },
    msgText: { fontSize: 15, lineHeight: 21 },
    msgTextMine: { color: Colors.bubbleTextMine },
    msgTextOther: { color: Colors.bubbleTextOther },
    msgMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 3 },
    msgTime: { fontSize: 11, color: Colors.gray },
    msgTimeMine: { color: 'rgba(255,255,255,0.6)' },
    typingBar: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 6,
        backgroundColor: Colors.white, gap: 8,
    },
    typingDots: { flexDirection: 'row', gap: 3 },
    typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.gray },
    typingDot1: { opacity: 0.4 },
    typingDot2: { opacity: 0.6 },
    typingDot3: { opacity: 0.8 },
    typingText: { fontSize: 13, color: Colors.textSecondary, fontStyle: 'italic' },
    inputBar: {
        flexDirection: 'row', alignItems: 'flex-end',
        paddingHorizontal: 10, paddingVertical: 8,
        paddingBottom: Platform.OS === 'ios' ? 28 : 8,
        backgroundColor: Colors.white,
        borderTopWidth: 1, borderTopColor: Colors.border, gap: 6,
    },
    attachButton: { padding: 8, marginBottom: 2 },
    textInput: {
        flex: 1, minHeight: 40, maxHeight: 120,
        backgroundColor: Colors.background, borderRadius: 20,
        paddingHorizontal: 16, paddingVertical: 10,
        fontSize: 15, color: Colors.text,
    },
    emojiButton: { padding: 8, marginBottom: 2 },
    sendButton: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: Colors.primary,
        justifyContent: 'center', alignItems: 'center',
    },
    sendButtonDisabled: { backgroundColor: Colors.grayLight },
});