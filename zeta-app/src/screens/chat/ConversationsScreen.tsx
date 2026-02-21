// src/screens/chat/ConversationsScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import api from '../../services/api';
import { SocketService, ConversationUpdated } from '../../services/socket';

const { width } = Dimensions.get('window');

// ── Tipos (match exacto con curl response) ──
interface Conversation {
    id: string;
    type: 'direct' | 'group';
    group: {
        id: string;
        name: string;
        description: string;
        type: string;
    } | null;
    group_id: string | null;
    participant_ids: string[];
    last_message_preview: string | null;
    last_message_at: string;
    created_at: string;
    unread_count: number;
    // Enriquecido en frontend para chats directos
    displayName?: string;
    displayInitials?: string;
}

export const ConversationsScreen: React.FC = () => {
    const { user } = useAuth();
    const nav = useNavigation<any>();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);

    // ── Cargar conversaciones ──
    const loadConversations = useCallback(async () => {
        try {
            const { data } = await api.get('/conversations');

            // Enriquecer chats directos con nombre del otro participante
            const enriched = await Promise.all(
                data.map(async (conv: Conversation) => {
                    if (conv.type === 'direct') {
                        const otherId = conv.participant_ids.find((id: string) => id !== user?.id);
                        if (otherId) {
                            try {
                                const { data: otherUser } = await api.get(`/users/${otherId}`);
                                return {
                                    ...conv,
                                    displayName: otherUser.name,
                                    displayInitials: getInitials(otherUser.name),
                                };
                            } catch {
                                return {
                                    ...conv,
                                    displayName: 'Usuario',
                                    displayInitials: 'U',
                                };
                            }
                        }
                    }
                    return {
                        ...conv,
                        displayName: conv.group?.name || 'Grupo',
                        displayInitials: conv.group?.name ? conv.group.name.substring(0, 2).toUpperCase() : 'G',
                    };
                })
            );

            // Ordenar por último mensaje más reciente
            enriched.sort(
                (a: Conversation, b: Conversation) =>
                    new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
            );

            setConversations(enriched);
        } catch (err) {
            console.error('Error cargando conversaciones:', err);
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    // ── Cargar al enfocar la pantalla ──
    useFocusEffect(
        useCallback(() => {
            loadConversations();
        }, [loadConversations])
    );

    // ── Escuchar actualizaciones en tiempo real ──
    useEffect(() => {
        const unsub = SocketService.onConversationUpdated((data: ConversationUpdated) => {
            setConversations((prev) =>
                prev
                    .map((c) =>
                        c.id === data.conversation_id
                            ? {
                                ...c,
                                last_message_preview: data.last_message_preview,
                                last_message_at: data.last_message_at,
                                unread_count: c.unread_count + 1,
                            }
                            : c
                    )
                    .sort(
                        (a, b) =>
                            new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
                    )
            );
        });

        return unsub;
    }, []);

    // ── Pull to refresh ──
    const onRefresh = async () => {
        setRefreshing(true);
        await loadConversations();
        setRefreshing(false);
    };

    // ── Formatear hora ──
    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        const mins = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (mins < 1) return 'Ahora';
        if (mins < 60) return `${mins}m`;
        if (hours < 24) return `${hours}h`;
        if (days < 7) return `${days}d`;
        return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    };

    // ── Navegar al chat ──
    const openChat = (conv: Conversation) => {
        // Marcar como leído
        SocketService.markAsRead(conv.id);

        // Resetear contador local
        setConversations((prev) =>
            prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c))
        );

        nav.navigate('ChatDetail', {
            conversationId: conv.id,
            title: conv.displayName,
            type: conv.type,
            participantIds: conv.participant_ids,
        });
    };

    // ── Render conversation item ──
    const renderItem = ({ item }: { item: Conversation }) => {
        const hasUnread = item.unread_count > 0;
        const isGroup = item.type === 'group';

        return (
            <TouchableOpacity
                style={[styles.convItem, hasUnread && styles.convItemUnread]}
                onPress={() => openChat(item)}
                activeOpacity={0.7}
            >
                {/* Avatar */}
                <View style={[styles.avatar, isGroup && styles.avatarGroup]}>
                    {isGroup ? (
                        <Feather name="users" size={20} color={Colors.white} />
                    ) : (
                        <Text style={styles.avatarText}>{item.displayInitials}</Text>
                    )}
                </View>

                {/* Info */}
                <View style={styles.convInfo}>
                    <View style={styles.convTopRow}>
                        <Text style={[styles.convName, hasUnread && styles.convNameBold]} numberOfLines={1}>
                            {item.displayName}
                        </Text>
                        <Text style={[styles.convTime, hasUnread && styles.convTimeBold]}>
                            {formatTime(item.last_message_at)}
                        </Text>
                    </View>
                    <View style={styles.convBottomRow}>
                        <Text
                            style={[styles.convPreview, hasUnread && styles.convPreviewBold]}
                            numberOfLines={1}
                        >
                            {item.last_message_preview || 'Sin mensajes aún'}
                        </Text>
                        {hasUnread && (
                            <View style={styles.unreadBadge}>
                                <Text style={styles.unreadText}>
                                    {item.unread_count > 9 ? '9+' : item.unread_count}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    // ── Empty state ──
    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>Sin conversaciones</Text>
            <Text style={styles.emptySub}>
                Conecta con compañeros desde Matches o únete a un grupo para empezar a chatear
            </Text>
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Chats</Text>
                <TouchableOpacity style={styles.headerButton}>
                    <Feather name="edit" size={22} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            {/* Lista */}
            <FlatList
                data={conversations}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                ListEmptyComponent={!loading ? renderEmpty : null}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
                }
                contentContainerStyle={conversations.length === 0 ? styles.emptyList : undefined}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
        </View>
    );
};

// ── Helpers ──
const getInitials = (name: string) => {
    const parts = name.split(' ');
    return parts.length > 1
        ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
        : name.substring(0, 2).toUpperCase();
};

// ══════════════════════════════════════════
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    // ── Header ──
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.screenPadding,
        paddingTop: 56,
        paddingBottom: Spacing.md,
        backgroundColor: Colors.white,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: '700',
        color: Colors.text,
    },
    headerButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // ── Conversation item ──
    convItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.screenPadding,
        paddingVertical: 14,
        backgroundColor: Colors.white,
        gap: 14,
    },
    convItemUnread: {
        backgroundColor: `${Colors.primary}06`,
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: Colors.secondary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarGroup: {
        backgroundColor: Colors.dark,
    },
    avatarText: {
        color: Colors.white,
        fontSize: 18,
        fontWeight: '700',
    },
    convInfo: {
        flex: 1,
    },
    convTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 3,
    },
    convName: {
        fontSize: 16,
        fontWeight: '500',
        color: Colors.text,
        flex: 1,
        marginRight: 8,
    },
    convNameBold: {
        fontWeight: '700',
    },
    convTime: {
        fontSize: 13,
        color: Colors.gray,
    },
    convTimeBold: {
        color: Colors.primary,
        fontWeight: '600',
    },
    convBottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    convPreview: {
        fontSize: 14,
        color: Colors.textSecondary,
        flex: 1,
        marginRight: 8,
    },
    convPreviewBold: {
        color: Colors.text,
        fontWeight: '600',
    },
    unreadBadge: {
        backgroundColor: Colors.primary,
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    unreadText: {
        color: Colors.white,
        fontSize: 12,
        fontWeight: '700',
    },
    separator: {
        height: 1,
        backgroundColor: Colors.border,
        marginLeft: Spacing.screenPadding + 66,
    },
    // ── Empty ──
    emptyList: {
        flexGrow: 1,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyIcon: {
        fontSize: 56,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.text,
        marginBottom: 8,
    },
    emptySub: {
        fontSize: 14,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
});