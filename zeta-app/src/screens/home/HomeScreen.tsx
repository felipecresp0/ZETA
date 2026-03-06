// src/screens/home/HomeScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    FlatList, RefreshControl, Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import api from '../../services/api';
import { getGroups, Group, joinGroup } from '../../services/groupService';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.42;

// ── Tipos ──
interface Match {
    id: string;
    name: string;
    photo: string | null;
    career: string;
    university: string;
    year: number;
    matchPercent: number;
    commonInterests: string[];
}

interface EventNear {
    id: string;
    title: string;
    date: string;
    time: string;
    location: string;
    attendees: number;
    groupName: string;
    groupId?: string;
}

interface RecentChat {
    id: string;
    title: string;
    type: 'direct' | 'group';
    lastMessage: string;
    time: string;
    unread: number;
    participantIds: string[];
}

// ── Helpers para mapear matches de la API ──
const mapApiMatch = (m: any): Match => {
    const u = m.matchedUser || {};
    const uni = u.academicOffer?.university?.short_name
        || u.academicOffer?.university?.name || '';
    const career = u.academicOffer?.career?.name || '';
    return {
        id: m.id,
        name: u.name || 'Usuario',
        photo: u.photo || null,
        career,
        university: uni,
        year: u.year || 1,
        matchPercent: m.affinity_score || 0,
        commonInterests: m.common_interests || [],
    };
};

// ══════════════════════════════════════════
export const HomeScreen: React.FC = () => {
    const { user } = useAuth();
    const nav = useNavigation<any>();
    const [refreshing, setRefreshing] = useState(false);

    const [matches, setMatches] = useState<Match[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [events, setEvents] = useState<EventNear[]>([]);
    const [chats, setChats] = useState<RecentChat[]>([]);

    const loadFeed = useCallback(async () => {
        try {
            // ── Matches IA (datos reales) ──
            try {
                const mRes = await api.get('/matches/me');
                const pending = mRes.data
                    .filter((m: any) => m.status === 'pending')
                    .slice(0, 5)
                    .map(mapApiMatch);
                setMatches(pending);
            } catch { setMatches([]); }

            // ── Grupos para explorar (datos reales) ──
            try {
                const data = await getGroups();
                // Mostrar max 4, priorizando los más recientes
                setGroups(data.slice(0, 4));
            } catch { setGroups([]); }

            // ── Eventos próximos (datos reales) ──
            try {
                const eRes = await api.get('/events/upcoming');
                const mapped = eRes.data.slice(0, 3).map((e: any) => {
                    const d = new Date(e.event_date);
                    return {
                        id: e.id,
                        title: e.name,
                        date: `${d.getDate()} ${d.toLocaleDateString('es-ES', { month: 'short' })}`,
                        time: d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
                        location: e.location || 'Sin ubicación',
                        attendees: 0,
                        groupName: e.group?.name || '',
                        groupId: e.group_id,
                    };
                });
                setEvents(mapped);
            } catch { setEvents([]); }

            // ── Chats recientes (datos reales) ──
            try {
                const cRes = await api.get('/conversations');
                const convs = cRes.data.slice(0, 3);

                // Resolver nombres de participantes para chats directos
                const nameCache = new Map<string, string>();
                const directConvs = convs.filter((c: any) => c.type === 'direct');
                const otherIds = directConvs
                    .flatMap((c: any) => (c.participant_ids || []).filter((p: string) => p !== user?.id))
                    .filter((id: string) => !nameCache.has(id));

                // Obtener nombres en paralelo
                await Promise.all(
                    [...new Set<string>(otherIds)].map(async (id) => {
                        try {
                            const { data: u } = await api.get(`/users/${id}`);
                            nameCache.set(id, u.name);
                        } catch {
                            nameCache.set(id, 'Usuario');
                        }
                    })
                );

                const mapped = convs.map((c: any) => {
                    let title = 'Chat';
                    if (c.type === 'group') {
                        title = c.group?.name || 'Grupo';
                    } else {
                        const otherId = c.participant_ids?.find((p: string) => p !== user?.id);
                        title = otherId ? (nameCache.get(otherId) || 'Usuario') : 'Chat';
                    }

                    return {
                        id: c.id,
                        title,
                        type: c.type,
                        lastMessage: c.last_message_preview || 'Sin mensajes aún',
                        time: c.last_message_at ? formatTimeAgo(c.last_message_at) : '',
                        unread: c.unread_count || 0,
                        participantIds: c.participant_ids || [],
                    };
                });
                setChats(mapped);
            } catch { setChats([]); }

        } catch (err) {
            console.error('Error cargando feed:', err);
        }
    }, [user?.id]);

    // Recargar al volver a la pantalla
    useFocusEffect(
        useCallback(() => {
            loadFeed();
        }, [loadFeed])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await loadFeed();
        setRefreshing(false);
    };

    const getGreeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Buenos días';
        if (h < 20) return 'Buenas tardes';
        return 'Buenas noches';
    };

    const firstName = user?.name?.split(' ')[0] || 'Estudiante';

    const getInitials = (name: string) => {
        const parts = name.split(' ');
        return parts.length > 1
            ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
            : name.substring(0, 2).toUpperCase();
    };

    // ── Acción unirse a grupo desde home ──
    const handleJoinGroup = async (groupId: string) => {
        try {
            await joinGroup(groupId);
            loadFeed(); // recargar
        } catch (e: any) {
            console.error('Error uniéndose:', e);
        }
    };

    return (
        <ScrollView
            style={s.container}
            contentContainerStyle={s.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
            showsVerticalScrollIndicator={false}
        >
            {/* ══════════ HEADER ══════════ */}
            <View style={s.header}>
                <View style={s.headerLeft}>
                    <TouchableOpacity style={s.avatar} onPress={() => nav.navigate('Profile')}>
                        <Text style={s.avatarText}>{getInitials(firstName)}</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={s.greeting}>{getGreeting()}, {firstName} 👋</Text>
                        <Text style={s.headerSub}>Descubre tu comunidad universitaria</Text>
                    </View>
                </View>
                <View style={s.headerRight}>
                    <TouchableOpacity style={s.iconButton}>
                        <Feather name="search" size={22} color={Colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.iconButton}>
                        <Feather name="bell" size={22} color={Colors.text} />
                        <View style={s.notifDot} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* ══════════ MATCHES IA ══════════ */}
            <View style={s.section}>
                <View style={s.sectionHeader}>
                    <View style={s.sectionTitleRow}>
                        <Text style={s.sectionIcon}>✨</Text>
                        <Text style={s.sectionTitle}>Matches sugeridos IA</Text>
                    </View>
                    <TouchableOpacity onPress={() => nav.navigate('Match')}>
                        <Text style={s.seeAll}>Ver más</Text>
                    </TouchableOpacity>
                </View>

                <FlatList
                    data={matches}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.horizontalList}
                    keyExtractor={i => i.id}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={s.matchCard} activeOpacity={0.85}>
                            <View style={s.matchAvatar}>
                                <Text style={s.matchAvatarText}>{getInitials(item.name)}</Text>
                            </View>
                            <View style={s.matchBadge}>
                                <Text style={s.matchBadgeText}>{item.matchPercent}%</Text>
                            </View>
                            <Text style={s.matchName} numberOfLines={1}>{item.name}</Text>
                            <Text style={s.matchCareer} numberOfLines={1}>
                                {item.university} · {item.career} · {item.year}º
                            </Text>
                            <View style={s.matchChips}>
                                {item.commonInterests.slice(0, 2).map((int, i) => (
                                    <View key={i} style={s.miniChip}>
                                        <Text style={s.miniChipText}>{int}</Text>
                                    </View>
                                ))}
                            </View>
                            <TouchableOpacity style={s.connectButton}>
                                <Text style={s.connectButtonText}>Conectar</Text>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    )}
                />
            </View>

            {/* ══════════ CHATS RECIENTES ══════════ */}
            {chats.length > 0 && (
                <View style={s.section}>
                    <View style={s.sectionHeader}>
                        <View style={s.sectionTitleRow}>
                            <Text style={s.sectionIcon}>💬</Text>
                            <Text style={s.sectionTitle}>Chats recientes</Text>
                        </View>
                        <TouchableOpacity onPress={() => nav.navigate('Chat')}>
                            <Text style={s.seeAll}>Ver todos</Text>
                        </TouchableOpacity>
                    </View>

                    {chats.map(chat => (
                        <TouchableOpacity
                            key={chat.id}
                            style={s.chatCard}
                            activeOpacity={0.85}
                            onPress={() => nav.navigate('Chat', {
                                screen: 'ChatDetail',
                                params: {
                                    conversationId: chat.id,
                                    title: chat.title,
                                    type: chat.type,
                                    participantIds: chat.participantIds,
                                },
                            })}
                        >
                            <View style={[s.chatAvatar, chat.type === 'group' && s.chatAvatarGroup]}>
                                {chat.type === 'group'
                                    ? <Feather name="users" size={16} color={Colors.white} />
                                    : <Text style={s.chatAvatarText}>{getInitials(chat.title)}</Text>
                                }
                            </View>
                            <View style={s.chatInfo}>
                                <Text style={s.chatName} numberOfLines={1}>{chat.title}</Text>
                                <Text style={s.chatLastMsg} numberOfLines={1}>{chat.lastMessage}</Text>
                            </View>
                            <View style={s.chatRight}>
                                {chat.time ? <Text style={s.chatTime}>{chat.time}</Text> : null}
                                {chat.unread > 0 && (
                                    <View style={s.unreadBadge}>
                                        <Text style={s.unreadText}>{chat.unread}</Text>
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* ══════════ GRUPOS RECOMENDADOS ══════════ */}
            <View style={s.section}>
                <View style={s.sectionHeader}>
                    <View style={s.sectionTitleRow}>
                        <Text style={s.sectionIcon}>👥</Text>
                        <Text style={s.sectionTitle}>Grupos para ti</Text>
                    </View>
                    <TouchableOpacity onPress={() => nav.navigate('Grupos')}>
                        <Text style={s.seeAll}>Ver todos</Text>
                    </TouchableOpacity>
                </View>

                {groups.length === 0 ? (
                    <View style={s.emptyCard}>
                        <Feather name="users" size={28} color={Colors.gray} />
                        <Text style={s.emptyText}>No hay grupos disponibles aún</Text>
                        <TouchableOpacity
                            style={s.emptyBtn}
                            onPress={() => nav.navigate('Grupos', { screen: 'CreateGroup' })}
                        >
                            <Text style={s.emptyBtnText}>Crear el primero</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    groups.map(g => {
                        const isMember = g.is_member || g.members?.some(
                            m => (m.user_id || m.id) === user?.id
                        );
                        const count = g.member_count || g.members?.length || 0;

                        return (
                            <TouchableOpacity
                                key={g.id}
                                style={s.groupCard}
                                activeOpacity={0.85}
                                onPress={() => nav.navigate('Grupos', {
                                    screen: 'GroupDetail',
                                    params: { groupId: g.id },
                                })}
                            >
                                <View style={s.groupLeft}>
                                    <View style={[s.groupIcon, { backgroundColor: groupColor(g.type) }]}>
                                        <Text style={s.groupIconText}>{groupEmoji(g.type)}</Text>
                                    </View>
                                    <View style={s.groupInfo}>
                                        <Text style={s.groupName} numberOfLines={1}>{g.name}</Text>
                                        <Text style={s.groupMeta}>
                                            {count} miembros · {typeLabel(g.type)}
                                        </Text>
                                    </View>
                                </View>
                                {isMember ? (
                                    <View style={s.memberTag}>
                                        <Text style={s.memberTagText}>Miembro</Text>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={s.joinButton}
                                        onPress={() => handleJoinGroup(g.id)}
                                    >
                                        <Text style={s.joinButtonText}>Unirse</Text>
                                    </TouchableOpacity>
                                )}
                            </TouchableOpacity>
                        );
                    })
                )}
            </View>

            {/* ══════════ EVENTOS CERCA ══════════ */}
            <View style={s.section}>
                <View style={s.sectionHeader}>
                    <View style={s.sectionTitleRow}>
                        <Text style={s.sectionIcon}>📅</Text>
                        <Text style={s.sectionTitle}>Próximos eventos</Text>
                    </View>
                    <TouchableOpacity onPress={() => nav.navigate('Calendario')}>
                        <Text style={s.seeAll}>Ver todos</Text>
                    </TouchableOpacity>
                </View>

                {events.length === 0 ? (
                    <View style={s.emptyCard}>
                        <Feather name="calendar" size={28} color={Colors.gray} />
                        <Text style={s.emptyText}>No hay eventos próximos</Text>
                    </View>
                ) : (
                    events.map(event => (
                        <TouchableOpacity key={event.id} style={s.eventCard} activeOpacity={0.85}>
                            <View style={s.eventDateBox}>
                                <Text style={s.eventDateDay}>{event.date.split(' ')[0]}</Text>
                                <Text style={s.eventDateMonth}>{event.date.split(' ')[1]}</Text>
                            </View>
                            <View style={s.eventInfo}>
                                <Text style={s.eventTitle}>{event.title}</Text>
                                <Text style={s.eventMeta}>{event.time} · {event.location}</Text>
                                {event.groupName ? (
                                    <View style={s.eventFooter}>
                                        <Feather name="users" size={13} color={Colors.gray} />
                                        <Text style={s.eventGroup}>{event.groupName}</Text>
                                    </View>
                                ) : null}
                            </View>
                            <Feather name="chevron-right" size={20} color={Colors.gray} />
                        </TouchableOpacity>
                    ))
                )}
            </View>

            <View style={{ height: 80 }} />
        </ScrollView>
    );
};

// ── Helpers ──
const formatTimeAgo = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diff < 1) return 'ahora';
    if (diff < 60) return `${diff} min`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h`;
    if (diff < 2880) return 'ayer';
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

const groupEmoji = (type: string) => {
    const m: Record<string, string> = { carrera: '🎓', interes: '❤️', estudio: '📚', general: '👥' };
    return m[type] || '👥';
};
const groupColor = (type: string) => {
    const m: Record<string, string> = { carrera: '#E3F2FD', interes: '#FCE4EC', estudio: '#FFF3E0', general: '#F5F5F5' };
    return m[type] || '#F5F5F5';
};
const typeLabel = (type: string) => {
    const m: Record<string, string> = { carrera: 'Carrera', interes: 'Interés', estudio: 'Estudio', general: 'General' };
    return m[type] || 'General';
};

// ══════════════════════════════════════════
const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    scrollContent: { paddingBottom: 20 },

    // Header
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.screenPadding, paddingTop: 56, paddingBottom: Spacing.md,
        backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    avatar: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
    },
    avatarText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
    greeting: { fontSize: 18, fontWeight: '700', color: Colors.text },
    headerSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 1 },
    headerRight: { flexDirection: 'row', gap: 6 },
    iconButton: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center',
    },
    notifDot: {
        position: 'absolute', top: 8, right: 8,
        width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.error,
    },

    // Sections
    section: { marginTop: Spacing.lg, paddingHorizontal: Spacing.screenPadding },
    sectionHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: Spacing.md,
    },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sectionIcon: { fontSize: 18 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
    seeAll: { fontSize: 14, fontWeight: '600', color: Colors.primary },
    horizontalList: { gap: 12 },

    // Match Cards
    matchCard: {
        width: CARD_WIDTH, backgroundColor: Colors.white, borderRadius: Spacing.radiusLg,
        padding: 16, alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },
    matchAvatar: {
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: Colors.secondary, justifyContent: 'center', alignItems: 'center', marginBottom: 8,
    },
    matchAvatarText: { color: Colors.white, fontSize: 20, fontWeight: '700' },
    matchBadge: {
        position: 'absolute', top: 12, right: 12,
        backgroundColor: Colors.success, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
    },
    matchBadgeText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
    matchName: { fontSize: 15, fontWeight: '600', color: Colors.text, textAlign: 'center' },
    matchCareer: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', marginTop: 2, marginBottom: 8 },
    matchChips: { flexDirection: 'row', gap: 4, marginBottom: 10 },
    miniChip: { backgroundColor: `${Colors.primary}15`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    miniChipText: { fontSize: 11, color: Colors.primary, fontWeight: '500' },
    connectButton: {
        backgroundColor: Colors.primary, paddingVertical: 8, paddingHorizontal: 20,
        borderRadius: Spacing.radiusMd, width: '100%', alignItems: 'center',
    },
    connectButtonText: { color: Colors.white, fontSize: 14, fontWeight: '600' },

    // Chat Cards
    chatCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
        borderRadius: Spacing.radiusMd, padding: 14, marginBottom: 8,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    chatAvatar: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: Colors.secondary, justifyContent: 'center', alignItems: 'center', marginRight: 12,
    },
    chatAvatarGroup: { backgroundColor: Colors.dark },
    chatAvatarText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
    chatInfo: { flex: 1 },
    chatName: { fontSize: 15, fontWeight: '600', color: Colors.text },
    chatLastMsg: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
    chatRight: { alignItems: 'flex-end', gap: 4 },
    chatTime: { fontSize: 11, color: Colors.gray },
    unreadBadge: {
        backgroundColor: Colors.primary, minWidth: 20, height: 20, borderRadius: 10,
        justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6,
    },
    unreadText: { color: Colors.white, fontSize: 11, fontWeight: '700' },

    // Group Cards
    groupCard: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: Colors.white, borderRadius: Spacing.radiusMd, padding: 14, marginBottom: 10,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    groupLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
    groupIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    groupIconText: { fontSize: 20 },
    groupInfo: { flex: 1 },
    groupName: { fontSize: 15, fontWeight: '600', color: Colors.text, flexShrink: 1 },
    groupMeta: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
    joinButton: {
        borderWidth: 1.5, borderColor: Colors.primary,
        paddingVertical: 7, paddingHorizontal: 14, borderRadius: Spacing.radiusMd,
    },
    joinButtonText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
    memberTag: {
        backgroundColor: `${Colors.primary}15`, paddingHorizontal: 10,
        paddingVertical: 5, borderRadius: 8,
    },
    memberTagText: { fontSize: 12, fontWeight: '600', color: Colors.primary },

    // Event Cards
    eventCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
        borderRadius: Spacing.radiusMd, padding: 14, marginBottom: 10, gap: 14,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    eventDateBox: {
        width: 48, height: 52, borderRadius: 10,
        backgroundColor: `${Colors.primary}12`, justifyContent: 'center', alignItems: 'center',
    },
    eventDateDay: { fontSize: 20, fontWeight: '700', color: Colors.primary, lineHeight: 24 },
    eventDateMonth: { fontSize: 11, fontWeight: '600', color: Colors.primary, textTransform: 'uppercase' },
    eventInfo: { flex: 1 },
    eventTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
    eventMeta: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
    eventFooter: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    eventGroup: { fontSize: 12, color: Colors.gray },

    // Empty states
    emptyCard: {
        backgroundColor: Colors.white, borderRadius: Spacing.radiusMd,
        padding: 24, alignItems: 'center', gap: 8,
    },
    emptyText: { fontSize: 14, color: Colors.gray, textAlign: 'center' },
    emptyBtn: {
        backgroundColor: Colors.primary, paddingHorizontal: 20,
        paddingVertical: 10, borderRadius: 10, marginTop: 4,
    },
    emptyBtnText: { color: Colors.white, fontWeight: '600', fontSize: 14 },
});