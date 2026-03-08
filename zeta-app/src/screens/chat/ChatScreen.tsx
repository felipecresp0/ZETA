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
    Modal,
    Alert,
    ScrollView,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import api from '../../services/api';
import { Calendar, DateData } from 'react-native-calendars';
import eventsService, { CreateEventPayload, RsvpSummary, ConflictAnalysis } from '../../services/eventsService';
import { ZAvatar } from '../../components/ZAvatar';
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
    senderPhoto?: string | null;
}

// Extraer un string ID usable del _id de MongoDB
const getMessageId = (msg: Message): string => {
    if (typeof msg._id === 'string') return msg._id;
    if (msg._id?.buffer?.data) {
        return msg._id.buffer.data.map((b: number) => b.toString(16).padStart(2, '0')).join('');
    }
    return `${msg.sender_id}-${msg.createdAt}`;
};

// Cache simple de nombres y fotos de usuario para chats grupales
const userNameCache = new Map<string, string>();
const userPhotoCache = new Map<string, string | null>();

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
    const [headerPhoto, setHeaderPhoto] = useState<string | null>(null);
    const [groupId, setGroupId] = useState<string | null>(null);
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const [showEventModal, setShowEventModal] = useState(false);
    const [eventForm, setEventForm] = useState({
        name: '',
        description: '',
        location: '',
    });
    const [eventDate, setEventDate] = useState<string>(''); // YYYY-MM-DD
    const [eventHour, setEventHour] = useState(12);
    const [eventMinute, setEventMinute] = useState(0);
    const [creatingEvent, setCreatingEvent] = useState(false);
    const [rsvpCache, setRsvpCache] = useState<Record<string, RsvpSummary>>({});
    const [showAttendeesModal, setShowAttendeesModal] = useState(false);
    const [attendeesEventId, setAttendeesEventId] = useState<string | null>(null);
    const [showManageModal, setShowManageModal] = useState(false);
    const [manageEventId, setManageEventId] = useState<string | null>(null);
    const [manageForm, setManageForm] = useState({ name: '', location: '' });
    const [manageDate, setManageDate] = useState('');
    const [manageHour, setManageHour] = useState(12);
    const [manageMinute, setManageMinute] = useState(0);
    const [updatingEvent, setUpdatingEvent] = useState(false);
    const [conflictData, setConflictData] = useState<ConflictAnalysis | null>(null);
    const [showConflictModal, setShowConflictModal] = useState(false);

    const flatListRef = useRef<FlatList>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isTypingRef = useRef(false);

    // ── Unirse a la room del socket + cargar historial ──
    useEffect(() => {
        SocketService.joinConversation(conversationId);
        loadMessages();

        if (type === 'direct') {
            // Cargar foto del otro usuario para el header
            const otherId = participantIds.find((id: string) => id !== user?.id);
            if (otherId) {
                api.get(`/users/${otherId}`)
                    .then(({ data }) => setHeaderPhoto(data.photos?.[0] || null))
                    .catch(() => {});
            }
        } else if (type === 'group') {
            // Obtener group_id de la conversación para navegación
            api.get(`/conversations/${conversationId}`)
                .then(({ data }) => setGroupId(data.group_id || null))
                .catch(() => {});
        }
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

    // ── Obtener nombres y fotos de usuarios para mensajes de grupo ──
    const enrichWithNames = async (msgs: Message[]): Promise<Message[]> => {
        const uniqueIds = [...new Set(msgs.map((m) => m.sender_id))];
        const uncached = uniqueIds.filter((id) => !userNameCache.has(id));
        await Promise.all(
            uncached.map(async (id) => {
                try {
                    const { data } = await api.get(`/users/${id}`);
                    userNameCache.set(id, data.name);
                    userPhotoCache.set(id, data.photos?.[0] || null);
                } catch {
                    userNameCache.set(id, 'Usuario');
                    userPhotoCache.set(id, null);
                }
            })
        );
        return msgs.map((m) => ({
            ...m,
            senderName: userNameCache.get(m.sender_id) || 'Usuario',
            senderPhoto: userPhotoCache.get(m.sender_id) || null,
        }));
    };

    // ── WebSocket: escuchar mensajes nuevos ──
    useEffect(() => {
        const unsubMsg = SocketService.onNewMessage((msg: NewMessage) => {
            if (msg.conversation_id !== conversationId) return;

            const enriched: Message = {
                ...msg,
                senderName: userNameCache.get(msg.sender_id) || undefined,
                senderPhoto: userPhotoCache.get(msg.sender_id) || null,
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

    // ── Navegar a detalle (grupo o usuario) ──
    const handleOpenDetail = () => {
        if (type === 'group' && groupId) {
            (nav as any).navigate('GroupDetailModal', { groupId });
        } else if (type === 'direct') {
            const otherId = participantIds.find((id: string) => id !== user?.id);
            if (otherId) {
                (nav as any).navigate('UserDetail', { userId: otherId, conversationId });
            }
        }
    };

    // ── Crear evento desde el chat del grupo ──
    const handleCreateEvent = async () => {
        if (!eventForm.name.trim() || !eventDate) {
            Alert.alert('Campos requeridos', 'Nombre y fecha son obligatorios.');
            return;
        }
        if (!groupId) return;

        setCreatingEvent(true);
        try {
            const hh = String(eventHour).padStart(2, '0');
            const mm = String(eventMinute).padStart(2, '0');
            const isoDate = new Date(`${eventDate}T${hh}:${mm}:00`).toISOString();
            const payload: CreateEventPayload = {
                name: eventForm.name.trim(),
                description: eventForm.description.trim() || undefined,
                event_date: isoDate,
                location: eventForm.location.trim() || undefined,
                group_id: groupId,
            };
            const created = await eventsService.create(payload);

            // Enviar como mensaje especial en el chat
            const eventMsg = JSON.stringify({
                _type: 'event',
                eventId: created.id,
                name: created.name,
                event_date: created.event_date,
                location: created.location || '',
                description: created.description || '',
            });

            SocketService.sendMessage({
                conversation_id: conversationId,
                content: eventMsg,
                type: 'event',
            });

            setShowEventModal(false);
            setEventForm({ name: '', description: '', location: '' });
            setEventDate('');
            setEventHour(12);
            setEventMinute(0);

            // Mostrar conflictos IA si los hay
            if (created.conflicts?.has_conflicts) {
                setConflictData(created.conflicts);
                setShowConflictModal(true);
            }
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.message || 'No se pudo crear el evento');
        } finally {
            setCreatingEvent(false);
        }
    };

    // ── RSVP: confirmar / declinar asistencia ──
    const handleRsvp = async (eventId: string, status: 'going' | 'not_going') => {
        try {
            const result = await eventsService.rsvp(eventId, status);
            setRsvpCache(prev => ({ ...prev, [eventId]: result }));

            // Mostrar conflictos IA si confirma asistencia y los hay
            if (status === 'going' && result.conflicts?.has_conflicts) {
                setConflictData(result.conflicts);
                setShowConflictModal(true);
            }
        } catch (e: any) {
            Alert.alert('Error', 'No se pudo registrar tu respuesta');
        }
    };

    const loadRsvp = async (eventId: string) => {
        if (rsvpCache[eventId]) return;
        try {
            const summary = await eventsService.getRsvp(eventId);
            setRsvpCache(prev => ({ ...prev, [eventId]: summary }));
        } catch {}
    };

    // ── Abrir modal de participantes ──
    const openAttendees = (eventId: string) => {
        setAttendeesEventId(eventId);
        setShowAttendeesModal(true);
        // Refrescar datos
        eventsService.getRsvp(eventId).then(s => {
            setRsvpCache(prev => ({ ...prev, [eventId]: s }));
        }).catch(() => {});
    };

    // ── Abrir modal de gestión (solo creador) ──
    const openManageEvent = (eventId: string, evt: any) => {
        setManageEventId(eventId);
        setManageForm({ name: evt.name || '', location: evt.location || '' });
        const d = new Date(evt.event_date);
        setManageDate(d.toISOString().slice(0, 10));
        setManageHour(d.getHours());
        setManageMinute(d.getMinutes());
        setShowManageModal(true);
        // Refrescar RSVP
        eventsService.getRsvp(eventId).then(s => {
            setRsvpCache(prev => ({ ...prev, [eventId]: s }));
        }).catch(() => {});
    };

    // ── Actualizar evento ──
    const handleUpdateEvent = async () => {
        if (!manageEventId || !manageForm.name.trim() || !manageDate) return;
        setUpdatingEvent(true);
        try {
            const hh = String(manageHour).padStart(2, '0');
            const mm = String(manageMinute).padStart(2, '0');
            const isoDate = new Date(`${manageDate}T${hh}:${mm}:00`).toISOString();
            await eventsService.update(manageEventId, {
                name: manageForm.name.trim(),
                event_date: isoDate,
                location: manageForm.location.trim() || undefined,
            });
            Alert.alert('Actualizado', 'El evento ha sido actualizado.');
            setShowManageModal(false);
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.message || 'No se pudo actualizar');
        } finally {
            setUpdatingEvent(false);
        }
    };

    // ── Cancelar evento ──
    const handleCancelEvent = () => {
        if (!manageEventId) return;
        Alert.alert('Cancelar evento', 'Se eliminará el evento para todos. Esta acción no se puede deshacer.', [
            { text: 'No', style: 'cancel' },
            {
                text: 'Cancelar evento', style: 'destructive', onPress: async () => {
                    try {
                        await eventsService.remove(manageEventId);
                        // Eliminar mensajes del evento del estado local
                        setMessages(prev => prev.filter(m => {
                            if (m.type !== 'event') return true;
                            try {
                                const parsed = JSON.parse(m.content);
                                return parsed.eventId !== manageEventId;
                            } catch { return true; }
                        }));
                        setShowManageModal(false);
                    } catch (e: any) {
                        Alert.alert('Error', 'No se pudo cancelar el evento');
                    }
                },
            },
        ]);
    };

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

    // ── Parsear mensaje de evento ──
    const parseEventMessage = (content: string) => {
        try {
            const parsed = JSON.parse(content);
            if (parsed._type === 'event') return parsed;
        } catch {}
        return null;
    };

    // ── Render tarjeta de evento ──
    const renderEventCard = (item: Message, isMine: boolean) => {
        const evt = parseEventMessage(item.content);
        if (!evt) return null;

        const d = new Date(evt.event_date);
        const dateStr = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
        const timeStr = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        const rsvp = evt.eventId ? rsvpCache[evt.eventId] : null;
        if (evt.eventId && !rsvpCache[evt.eventId]) {
            loadRsvp(evt.eventId);
        }

        const isCreator = rsvp?.is_creator || item.sender_id === user?.id;

        return (
            <View style={styles.eventCard}>
                <View style={styles.eventCardHeader}>
                    <Ionicons name="calendar" size={18} color="#7C3AED" />
                    <Text style={styles.eventCardLabel}>Nuevo evento</Text>
                </View>
                <Text style={styles.eventCardName}>{evt.name}</Text>
                {evt.description ? (
                    <Text style={styles.eventCardDesc}>{evt.description}</Text>
                ) : null}
                <View style={styles.eventCardInfo}>
                    <Ionicons name="time-outline" size={14} color="#666" />
                    <Text style={styles.eventCardInfoText}>{dateStr} · {timeStr}</Text>
                </View>
                {evt.location ? (
                    <View style={styles.eventCardInfo}>
                        <Ionicons name="location-outline" size={14} color="#666" />
                        <Text style={styles.eventCardInfoText}>{evt.location}</Text>
                    </View>
                ) : null}

                {/* Asistentes */}
                {rsvp && rsvp.going_count > 0 && (
                    <TouchableOpacity
                        style={styles.attendeesBtn}
                        onPress={() => openAttendees(evt.eventId)}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="people-outline" size={14} color="#7C3AED" />
                        <Text style={styles.attendeesBtnText}>
                            {rsvp.going_count} {rsvp.going_count === 1 ? 'asistente' : 'asistentes'}
                        </Text>
                        <Feather name="chevron-right" size={14} color="#7C3AED" />
                    </TouchableOpacity>
                )}

                {/* RSVP buttons — solo para NO creadores */}
                {evt.eventId && !isCreator && (
                    <View style={styles.rsvpRow}>
                        <TouchableOpacity
                            style={[
                                styles.rsvpBtn,
                                styles.rsvpBtnGoing,
                                rsvp?.my_status === 'going' && styles.rsvpBtnGoingActive,
                            ]}
                            onPress={() => handleRsvp(evt.eventId, 'going')}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={rsvp?.my_status === 'going' ? 'checkmark-circle' : 'checkmark-circle-outline'}
                                size={16}
                                color={rsvp?.my_status === 'going' ? '#FFF' : '#10B981'}
                            />
                            <Text style={[
                                styles.rsvpBtnText,
                                rsvp?.my_status === 'going' && styles.rsvpBtnTextActive,
                            ]}>Iré</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.rsvpBtn,
                                styles.rsvpBtnDecline,
                                rsvp?.my_status === 'not_going' && styles.rsvpBtnDeclineActive,
                            ]}
                            onPress={() => handleRsvp(evt.eventId, 'not_going')}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={rsvp?.my_status === 'not_going' ? 'close-circle' : 'close-circle-outline'}
                                size={16}
                                color={rsvp?.my_status === 'not_going' ? '#FFF' : '#EF4444'}
                            />
                            <Text style={[
                                styles.rsvpBtnText,
                                { color: '#EF4444' },
                                rsvp?.my_status === 'not_going' && styles.rsvpBtnTextActive,
                            ]}>No iré</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Gestionar evento — solo para el creador */}
                {evt.eventId && isCreator && (
                    <TouchableOpacity
                        style={styles.manageBtn}
                        onPress={() => openManageEvent(evt.eventId, evt)}
                        activeOpacity={0.7}
                    >
                        <Feather name="settings" size={14} color="#7C3AED" />
                        <Text style={styles.manageBtnText}>Gestionar evento</Text>
                    </TouchableOpacity>
                )}

                <View style={styles.msgMeta}>
                    <Text style={[styles.msgTime, isMine && styles.msgTimeMine]}>
                        {formatMsgTime(item.createdAt)}
                    </Text>
                </View>
            </View>
        );
    };

    // ── Render mensaje ──
    const renderMessage = ({ item, index }: { item: Message; index: number }) => {
        const isMine = item.sender_id === user?.id;
        const firstInGroup = isFirstInGroup(index);
        const showDate = shouldShowDate(index);
        const isEventMsg = item.type === 'event' || parseEventMessage(item.content) !== null;

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
                        <View style={styles.msgAvatarWrap}>
                            <ZAvatar name={item.senderName || 'U'} photo={item.senderPhoto} size={28} />
                        </View>
                    ) : !isMine && type === 'group' ? (
                        <View style={styles.msgAvatarPlaceholder} />
                    ) : null}

                    {isEventMsg ? (
                        <View style={[
                            styles.bubble,
                            isMine ? styles.bubbleMine : styles.bubbleOther,
                            firstInGroup && !isMine && styles.bubbleFirstOther,
                            firstInGroup && isMine && styles.bubbleFirstMine,
                            { padding: 0, overflow: 'hidden' },
                        ]}>
                            {!isMine && type === 'group' && firstInGroup && (
                                <Text style={[styles.senderName, { paddingHorizontal: 14, paddingTop: 8 }]}>{item.senderName}</Text>
                            )}
                            {renderEventCard(item, isMine)}
                        </View>
                    ) : (
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
                    )}
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
                <TouchableOpacity onPress={handleOpenDetail} style={styles.headerTouchable} activeOpacity={0.7}>
                    {type === 'group' ? (
                        <View style={[styles.headerAvatar, styles.headerAvatarGroup]}>
                            <Feather name="users" size={16} color={Colors.white} />
                        </View>
                    ) : (
                        <ZAvatar name={title} photo={headerPhoto} size={38} />
                    )}
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
                </TouchableOpacity>
                <TouchableOpacity style={styles.headerAction} onPress={handleOpenDetail}>
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

            {/* ── Attachment menu overlay ── */}
            {showAttachMenu && (
                <View style={styles.attachMenu}>
                    {type === 'group' && (
                        <TouchableOpacity
                            style={styles.attachMenuItem}
                            onPress={() => {
                                setShowAttachMenu(false);
                                setShowEventModal(true);
                            }}
                        >
                            <View style={[styles.attachMenuIcon, { backgroundColor: '#EDE9FE' }]}>
                                <Ionicons name="calendar" size={20} color="#7C3AED" />
                            </View>
                            <Text style={styles.attachMenuText}>Crear evento</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={styles.attachMenuItem}
                        onPress={() => setShowAttachMenu(false)}
                    >
                        <View style={[styles.attachMenuIcon, { backgroundColor: '#DBEAFE' }]}>
                            <Ionicons name="image" size={20} color="#2563EB" />
                        </View>
                        <Text style={styles.attachMenuText}>Imagen</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.attachMenuClose}
                        onPress={() => setShowAttachMenu(false)}
                    >
                        <Text style={styles.attachMenuCloseText}>Cancelar</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* ── Input bar ── */}
            <View style={styles.inputBar}>
                <TouchableOpacity style={styles.attachButton} onPress={() => setShowAttachMenu(!showAttachMenu)}>
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
            {/* ── Modal crear evento ── */}
            <Modal visible={showEventModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Crear evento</Text>
                            <TouchableOpacity onPress={() => setShowEventModal(false)}>
                                <Feather name="x" size={24} color={Colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            <Text style={styles.modalLabel}>Nombre *</Text>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="Ej: Estudio grupal de cálculo"
                                placeholderTextColor={Colors.gray}
                                value={eventForm.name}
                                onChangeText={(t) => setEventForm(p => ({ ...p, name: t }))}
                            />

                            <Text style={styles.modalLabel}>Descripción</Text>
                            <TextInput
                                style={[styles.modalInput, { height: 70, textAlignVertical: 'top' }]}
                                placeholder="Detalles del evento..."
                                placeholderTextColor={Colors.gray}
                                value={eventForm.description}
                                onChangeText={(t) => setEventForm(p => ({ ...p, description: t }))}
                                multiline
                            />

                            <Text style={styles.modalLabel}>Fecha *</Text>
                            <Calendar
                                minDate={new Date().toISOString().slice(0, 10)}
                                onDayPress={(day: DateData) => setEventDate(day.dateString)}
                                markedDates={eventDate ? {
                                    [eventDate]: { selected: true, selectedColor: '#7C3AED' },
                                } : {}}
                                theme={{
                                    calendarBackground: Colors.background,
                                    monthTextColor: Colors.text,
                                    textMonthFontWeight: '700',
                                    textMonthFontSize: 15,
                                    arrowColor: '#7C3AED',
                                    dayTextColor: Colors.text,
                                    textDayFontSize: 14,
                                    selectedDayBackgroundColor: '#7C3AED',
                                    selectedDayTextColor: '#FFF',
                                    todayTextColor: '#7C3AED',
                                    textDisabledColor: '#BDBDBD',
                                    textSectionTitleColor: Colors.textSecondary,
                                }}
                                style={styles.modalCalendar}
                            />
                            {eventDate ? (
                                <Text style={styles.selectedDateText}>
                                    {new Date(eventDate + 'T00:00:00').toLocaleDateString('es-ES', {
                                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                                    })}
                                </Text>
                            ) : null}

                            <Text style={styles.modalLabel}>Hora *</Text>
                            <View style={styles.timePickerRow}>
                                <View style={styles.timePickerCol}>
                                    <TouchableOpacity
                                        style={styles.timeArrow}
                                        onPress={() => setEventHour(h => h < 23 ? h + 1 : 0)}
                                    >
                                        <Feather name="chevron-up" size={22} color={Colors.text} />
                                    </TouchableOpacity>
                                    <View style={styles.timeDisplay}>
                                        <Text style={styles.timeText}>{String(eventHour).padStart(2, '0')}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.timeArrow}
                                        onPress={() => setEventHour(h => h > 0 ? h - 1 : 23)}
                                    >
                                        <Feather name="chevron-down" size={22} color={Colors.text} />
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.timeSeparator}>:</Text>
                                <View style={styles.timePickerCol}>
                                    <TouchableOpacity
                                        style={styles.timeArrow}
                                        onPress={() => setEventMinute(m => m < 55 ? m + 5 : 0)}
                                    >
                                        <Feather name="chevron-up" size={22} color={Colors.text} />
                                    </TouchableOpacity>
                                    <View style={styles.timeDisplay}>
                                        <Text style={styles.timeText}>{String(eventMinute).padStart(2, '0')}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.timeArrow}
                                        onPress={() => setEventMinute(m => m > 0 ? m - 5 : 55)}
                                    >
                                        <Feather name="chevron-down" size={22} color={Colors.text} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Quick time options */}
                            <View style={styles.quickTimeRow}>
                                {[
                                    { label: '09:00', h: 9, m: 0 },
                                    { label: '12:00', h: 12, m: 0 },
                                    { label: '15:00', h: 15, m: 0 },
                                    { label: '18:00', h: 18, m: 0 },
                                    { label: '20:00', h: 20, m: 0 },
                                ].map(opt => {
                                    const isSelected = eventHour === opt.h && eventMinute === opt.m;
                                    return (
                                        <TouchableOpacity
                                            key={opt.label}
                                            style={[styles.quickTimeChip, isSelected && styles.quickTimeChipActive]}
                                            onPress={() => { setEventHour(opt.h); setEventMinute(opt.m); }}
                                        >
                                            <Text style={[styles.quickTimeText, isSelected && styles.quickTimeTextActive]}>
                                                {opt.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={styles.modalLabel}>Ubicación</Text>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="Ej: Biblioteca central"
                                placeholderTextColor={Colors.gray}
                                value={eventForm.location}
                                onChangeText={(t) => setEventForm(p => ({ ...p, location: t }))}
                            />

                            <View style={{ height: 20 }} />
                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.modalCreateBtn, creatingEvent && { opacity: 0.6 }]}
                            onPress={handleCreateEvent}
                            disabled={creatingEvent}
                            activeOpacity={0.7}
                        >
                            {creatingEvent ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.modalCreateBtnText}>Crear y enviar al chat</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ── Modal participantes ── */}
            <Modal visible={showAttendeesModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Participantes</Text>
                            <TouchableOpacity onPress={() => setShowAttendeesModal(false)}>
                                <Feather name="x" size={24} color={Colors.text} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            {attendeesEventId && rsvpCache[attendeesEventId] && (
                                <>
                                    {rsvpCache[attendeesEventId].going_users.length > 0 && (
                                        <>
                                            <Text style={styles.attendeeSection}>
                                                Asistirán ({rsvpCache[attendeesEventId].going_count})
                                            </Text>
                                            {rsvpCache[attendeesEventId].going_users.map(u => (
                                                <View key={u.id} style={styles.attendeeRow}>
                                                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                                                    <Text style={styles.attendeeName}>{u.name}</Text>
                                                </View>
                                            ))}
                                        </>
                                    )}
                                    {rsvpCache[attendeesEventId].not_going_users.length > 0 && (
                                        <>
                                            <Text style={[styles.attendeeSection, { marginTop: 20 }]}>
                                                No asistirán ({rsvpCache[attendeesEventId].not_going_count})
                                            </Text>
                                            {rsvpCache[attendeesEventId].not_going_users.map(u => (
                                                <View key={u.id} style={styles.attendeeRow}>
                                                    <Ionicons name="close-circle" size={18} color="#EF4444" />
                                                    <Text style={styles.attendeeName}>{u.name}</Text>
                                                </View>
                                            ))}
                                        </>
                                    )}
                                    {rsvpCache[attendeesEventId].going_count === 0 && rsvpCache[attendeesEventId].not_going_count === 0 && (
                                        <Text style={{ color: Colors.textSecondary, textAlign: 'center', marginTop: 20 }}>
                                            Nadie ha respondido aún
                                        </Text>
                                    )}
                                </>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ── Modal gestionar evento (creador) ── */}
            <Modal visible={showManageModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Gestionar evento</Text>
                            <TouchableOpacity onPress={() => setShowManageModal(false)}>
                                <Feather name="x" size={24} color={Colors.text} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            {/* Participantes inline */}
                            {manageEventId && rsvpCache[manageEventId] && (
                                <View style={styles.manageSection}>
                                    <Text style={styles.manageSectionTitle}>Respuestas</Text>
                                    <View style={styles.manageStatsRow}>
                                        <View style={[styles.manageStat, { backgroundColor: '#F0FDF4' }]}>
                                            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                                            <Text style={[styles.manageStatText, { color: '#10B981' }]}>
                                                {rsvpCache[manageEventId].going_count} irán
                                            </Text>
                                        </View>
                                        <View style={[styles.manageStat, { backgroundColor: '#FEF2F2' }]}>
                                            <Ionicons name="close-circle" size={16} color="#EF4444" />
                                            <Text style={[styles.manageStatText, { color: '#EF4444' }]}>
                                                {rsvpCache[manageEventId].not_going_count} no irán
                                            </Text>
                                        </View>
                                    </View>
                                    {rsvpCache[manageEventId].going_users.map(u => (
                                        <View key={u.id} style={styles.attendeeRow}>
                                            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                                            <Text style={styles.attendeeName}>{u.name}</Text>
                                        </View>
                                    ))}
                                    {rsvpCache[manageEventId].not_going_users.map(u => (
                                        <View key={u.id} style={styles.attendeeRow}>
                                            <Ionicons name="close-circle" size={16} color="#EF4444" />
                                            <Text style={styles.attendeeName}>{u.name}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            <Text style={styles.manageSectionTitle}>Editar evento</Text>

                            <Text style={styles.modalLabel}>Nombre</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={manageForm.name}
                                onChangeText={(t) => setManageForm(p => ({ ...p, name: t }))}
                                placeholder="Nombre del evento"
                                placeholderTextColor={Colors.gray}
                            />

                            <Text style={styles.modalLabel}>Fecha</Text>
                            <Calendar
                                current={manageDate || undefined}
                                minDate={new Date().toISOString().slice(0, 10)}
                                onDayPress={(day: DateData) => setManageDate(day.dateString)}
                                markedDates={manageDate ? {
                                    [manageDate]: { selected: true, selectedColor: '#7C3AED' },
                                } : {}}
                                theme={{
                                    calendarBackground: Colors.background,
                                    monthTextColor: Colors.text,
                                    textMonthFontWeight: '700',
                                    textMonthFontSize: 15,
                                    arrowColor: '#7C3AED',
                                    dayTextColor: Colors.text,
                                    textDayFontSize: 14,
                                    selectedDayBackgroundColor: '#7C3AED',
                                    selectedDayTextColor: '#FFF',
                                    todayTextColor: '#7C3AED',
                                    textDisabledColor: '#BDBDBD',
                                    textSectionTitleColor: Colors.textSecondary,
                                }}
                                style={styles.modalCalendar}
                            />

                            <Text style={styles.modalLabel}>Hora</Text>
                            <View style={styles.timePickerRow}>
                                <View style={styles.timePickerCol}>
                                    <TouchableOpacity style={styles.timeArrow} onPress={() => setManageHour(h => h < 23 ? h + 1 : 0)}>
                                        <Feather name="chevron-up" size={22} color={Colors.text} />
                                    </TouchableOpacity>
                                    <View style={styles.timeDisplay}>
                                        <Text style={styles.timeText}>{String(manageHour).padStart(2, '0')}</Text>
                                    </View>
                                    <TouchableOpacity style={styles.timeArrow} onPress={() => setManageHour(h => h > 0 ? h - 1 : 23)}>
                                        <Feather name="chevron-down" size={22} color={Colors.text} />
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.timeSeparator}>:</Text>
                                <View style={styles.timePickerCol}>
                                    <TouchableOpacity style={styles.timeArrow} onPress={() => setManageMinute(m => m < 55 ? m + 5 : 0)}>
                                        <Feather name="chevron-up" size={22} color={Colors.text} />
                                    </TouchableOpacity>
                                    <View style={styles.timeDisplay}>
                                        <Text style={styles.timeText}>{String(manageMinute).padStart(2, '0')}</Text>
                                    </View>
                                    <TouchableOpacity style={styles.timeArrow} onPress={() => setManageMinute(m => m > 0 ? m - 5 : 55)}>
                                        <Feather name="chevron-down" size={22} color={Colors.text} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <Text style={styles.modalLabel}>Ubicación</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={manageForm.location}
                                onChangeText={(t) => setManageForm(p => ({ ...p, location: t }))}
                                placeholder="Ubicación"
                                placeholderTextColor={Colors.gray}
                            />

                            <TouchableOpacity
                                style={[styles.modalCreateBtn, updatingEvent && { opacity: 0.6 }]}
                                onPress={handleUpdateEvent}
                                disabled={updatingEvent}
                                activeOpacity={0.7}
                            >
                                {updatingEvent ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.modalCreateBtnText}>Guardar cambios</Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.cancelEventBtn}
                                onPress={handleCancelEvent}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                <Text style={styles.cancelEventBtnText}>Cancelar evento</Text>
                            </TouchableOpacity>

                            <View style={{ height: 30 }} />
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ── Modal de conflictos IA ── */}
            <Modal visible={showConflictModal} transparent animationType="fade">
                <View style={styles.conflictOverlay}>
                    <View style={styles.conflictModal}>
                        <View style={styles.conflictHeader}>
                            <View style={styles.conflictIconWrap}>
                                <Feather name="alert-triangle" size={24} color="#F59E0B" />
                            </View>
                            <Text style={styles.conflictTitle}>Conflictos detectados</Text>
                            <TouchableOpacity onPress={() => setShowConflictModal(false)}>
                                <Feather name="x" size={22} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.conflictBody} showsVerticalScrollIndicator={false}>
                            {conflictData?.summary && (
                                <Text style={styles.conflictSummary}>{conflictData.summary}</Text>
                            )}

                            {conflictData?.conflicts?.map((c, i) => (
                                <View key={i} style={[
                                    styles.conflictItem,
                                    c.severity === 'high' && styles.conflictItemHigh,
                                    c.severity === 'medium' && styles.conflictItemMedium,
                                    c.severity === 'low' && styles.conflictItemLow,
                                ]}>
                                    <View style={styles.conflictItemHeader}>
                                        <Feather
                                            name={c.severity === 'high' ? 'alert-circle' : c.severity === 'medium' ? 'alert-triangle' : 'info'}
                                            size={16}
                                            color={c.severity === 'high' ? '#EF4444' : c.severity === 'medium' ? '#F59E0B' : '#6B7280'}
                                        />
                                        <Text style={[
                                            styles.conflictSeverity,
                                            c.severity === 'high' && { color: '#EF4444' },
                                            c.severity === 'medium' && { color: '#F59E0B' },
                                            c.severity === 'low' && { color: '#6B7280' },
                                        ]}>
                                            {c.severity === 'high' ? 'Alta' : c.severity === 'medium' ? 'Media' : 'Baja'}
                                        </Text>
                                    </View>
                                    <Text style={styles.conflictDesc}>{c.description}</Text>
                                </View>
                            ))}

                            {conflictData?.recommendations && conflictData.recommendations.length > 0 && (
                                <View style={styles.conflictSection}>
                                    <View style={styles.conflictSectionHeader}>
                                        <Feather name="cpu" size={14} color={Colors.primary} />
                                        <Text style={styles.conflictSectionTitle}>Recomendaciones IA</Text>
                                    </View>
                                    {conflictData.recommendations.map((r, i) => (
                                        <View key={i} style={styles.recommendationItem}>
                                            <Text style={styles.recommendationBullet}>•</Text>
                                            <Text style={styles.recommendationText}>{r}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {conflictData?.suggested_times && conflictData.suggested_times.length > 0 && (
                                <View style={styles.conflictSection}>
                                    <View style={styles.conflictSectionHeader}>
                                        <Feather name="clock" size={14} color="#10B981" />
                                        <Text style={styles.conflictSectionTitle}>Horarios sugeridos</Text>
                                    </View>
                                    {conflictData.suggested_times.map((t, i) => (
                                        <View key={i} style={styles.suggestedTimeChip}>
                                            <Feather name="check" size={12} color="#10B981" />
                                            <Text style={styles.suggestedTimeText}>{t}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </ScrollView>

                        <TouchableOpacity
                            style={styles.conflictCloseBtn}
                            onPress={() => setShowConflictModal(false)}
                        >
                            <Text style={styles.conflictCloseBtnText}>Entendido</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
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
    msgAvatarWrap: {
        marginRight: 6, marginTop: 2,
    },
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

    // Header touchable area
    headerTouchable: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    },

    // Attachment menu
    attachMenu: {
        backgroundColor: Colors.white,
        borderTopWidth: 1, borderTopColor: Colors.border,
        paddingHorizontal: 16, paddingVertical: 12,
    },
    attachMenuItem: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 12,
    },
    attachMenuIcon: {
        width: 40, height: 40, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center',
    },
    attachMenuText: { fontSize: 15, fontWeight: '500', color: Colors.text },
    attachMenuClose: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
    attachMenuCloseText: { fontSize: 14, color: Colors.gray, fontWeight: '500' },

    // Event card in message
    eventCard: {
        padding: 14, minWidth: 220,
    },
    eventCardHeader: {
        flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8,
    },
    eventCardLabel: { fontSize: 12, fontWeight: '600', color: '#7C3AED' },
    eventCardName: { fontSize: 15, fontWeight: '700', color: '#212121', marginBottom: 4 },
    eventCardDesc: { fontSize: 13, color: '#666', marginBottom: 6 },
    eventCardInfo: {
        flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4,
    },
    eventCardInfoText: { fontSize: 12, color: '#666' },

    // RSVP
    rsvpCount: { fontSize: 12, color: '#7C3AED', fontWeight: '600', marginTop: 8 },
    rsvpRow: {
        flexDirection: 'row', gap: 8, marginTop: 10,
    },
    rsvpBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 5, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5,
    },
    rsvpBtnGoing: {
        borderColor: '#10B981', backgroundColor: '#F0FDF4',
    },
    rsvpBtnGoingActive: {
        backgroundColor: '#10B981', borderColor: '#10B981',
    },
    rsvpBtnDecline: {
        borderColor: '#FCA5A5', backgroundColor: '#FEF2F2',
    },
    rsvpBtnDeclineActive: {
        backgroundColor: '#EF4444', borderColor: '#EF4444',
    },
    rsvpBtnText: { fontSize: 13, fontWeight: '600', color: '#10B981' },
    rsvpBtnTextActive: { color: '#FFF' },

    // Modal
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Colors.white,
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border,
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
    modalBody: { padding: 20 },
    modalLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, marginTop: 12 },
    modalInput: {
        backgroundColor: Colors.background, borderRadius: 12,
        paddingHorizontal: 14, paddingVertical: 12,
        fontSize: 15, color: Colors.text,
    },
    modalCalendar: {
        borderRadius: 12, overflow: 'hidden',
    },
    selectedDateText: {
        fontSize: 13, color: '#7C3AED', fontWeight: '600',
        textAlign: 'center', marginTop: 6, textTransform: 'capitalize',
    },

    // Time picker
    timePickerRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 4, marginTop: 8,
    },
    timePickerCol: { alignItems: 'center' },
    timeArrow: { padding: 6 },
    timeDisplay: {
        width: 60, height: 48, borderRadius: 12,
        backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center',
    },
    timeText: { fontSize: 24, fontWeight: '700', color: Colors.text },
    timeSeparator: { fontSize: 24, fontWeight: '700', color: Colors.text, marginHorizontal: 4 },

    // Quick time chips
    quickTimeRow: {
        flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 12,
    },
    quickTimeChip: {
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
        backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    },
    quickTimeChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
    quickTimeText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
    quickTimeTextActive: { color: '#FFF' },

    // Attendees button on event card
    attendeesBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        marginTop: 10, paddingVertical: 6, paddingHorizontal: 10,
        backgroundColor: '#F3E8FF', borderRadius: 8, alignSelf: 'flex-start',
    },
    attendeesBtnText: { fontSize: 12, fontWeight: '600', color: '#7C3AED' },

    // Manage button on event card (creator)
    manageBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, marginTop: 10, paddingVertical: 9,
        backgroundColor: '#F3E8FF', borderRadius: 10,
    },
    manageBtnText: { fontSize: 13, fontWeight: '600', color: '#7C3AED' },

    // Attendees modal
    attendeeSection: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 10 },
    attendeeRow: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.background,
    },
    attendeeName: { fontSize: 15, color: Colors.text, fontWeight: '500' },

    // Manage modal
    manageSection: {
        backgroundColor: Colors.background, borderRadius: 12, padding: 14, marginBottom: 16,
    },
    manageSectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 10 },
    manageStatsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    manageStat: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingVertical: 8, borderRadius: 10,
    },
    manageStatText: { fontSize: 13, fontWeight: '600' },
    cancelEventBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, paddingVertical: 14, marginTop: 10,
        borderWidth: 1.5, borderColor: '#FCA5A5', borderRadius: 14,
    },
    cancelEventBtnText: { fontSize: 15, fontWeight: '600', color: '#EF4444' },

    modalCreateBtn: {
        backgroundColor: '#7C3AED', marginHorizontal: 20, marginBottom: 30, marginTop: 10,
        borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    },
    modalCreateBtnText: { fontSize: 16, fontWeight: '600', color: '#FFF' },

    // ── Conflict modal ──
    conflictOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center', paddingHorizontal: 20,
    },
    conflictModal: {
        backgroundColor: Colors.white, borderRadius: 20,
        maxHeight: '80%', overflow: 'hidden',
    },
    conflictHeader: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        padding: 20, paddingBottom: 14,
        borderBottomWidth: 1, borderBottomColor: Colors.border,
    },
    conflictIconWrap: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center',
    },
    conflictTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: Colors.text },
    conflictBody: { padding: 20, paddingTop: 16 },
    conflictSummary: {
        fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 16,
    },
    conflictItem: {
        borderRadius: 12, padding: 14, marginBottom: 10,
        borderLeftWidth: 3,
    },
    conflictItemHigh: { backgroundColor: '#FEE2E2', borderLeftColor: '#EF4444' },
    conflictItemMedium: { backgroundColor: '#FEF3C7', borderLeftColor: '#F59E0B' },
    conflictItemLow: { backgroundColor: '#F3F4F6', borderLeftColor: '#6B7280' },
    conflictItemHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    conflictSeverity: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
    conflictDesc: { fontSize: 14, color: Colors.text, lineHeight: 20 },
    conflictSection: { marginTop: 16 },
    conflictSectionHeader: {
        flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10,
    },
    conflictSectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
    recommendationItem: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    recommendationBullet: { fontSize: 14, color: Colors.primary, fontWeight: '700' },
    recommendationText: { fontSize: 14, color: Colors.text, lineHeight: 20, flex: 1 },
    suggestedTimeChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: '#ECFDF5', paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: 10, marginBottom: 6,
    },
    suggestedTimeText: { fontSize: 13, color: '#059669', fontWeight: '600' },
    conflictCloseBtn: {
        backgroundColor: Colors.primary, marginHorizontal: 20, marginBottom: 20,
        borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    },
    conflictCloseBtnText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
});