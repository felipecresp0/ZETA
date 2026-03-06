// src/screens/search/SearchScreen.tsx
import React, { useState, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    FlatList, ActivityIndicator, Image,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { ZAvatar } from '../../components/ZAvatar';
import api from '../../services/api';

type Tab = 'users' | 'groups' | 'events';

export const SearchScreen: React.FC = () => {
    const nav = useNavigation<any>();
    const [query, setQuery] = useState('');
    const [tab, setTab] = useState<Tab>('users');
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [events, setEvents] = useState<any[]>([]);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const search = useCallback(async (q: string, t: Tab) => {
        if (q.length < 2) {
            setUsers([]); setGroups([]); setEvents([]);
            return;
        }
        setLoading(true);
        try {
            if (t === 'users') {
                const { data } = await api.get(`/search/users?q=${encodeURIComponent(q)}`);
                setUsers(data);
            } else if (t === 'groups') {
                const { data } = await api.get(`/search/groups?q=${encodeURIComponent(q)}`);
                setGroups(data);
            } else {
                const { data } = await api.get(`/search/events?q=${encodeURIComponent(q)}`);
                setEvents(data);
            }
        } catch {
        } finally {
            setLoading(false);
        }
    }, []);

    const handleQuery = (text: string) => {
        setQuery(text);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => search(text, tab), 400);
    };

    const handleTabChange = (t: Tab) => {
        setTab(t);
        if (query.length >= 2) search(query, t);
    };

    const renderUser = ({ item }: { item: any }) => {
        const uni = item.academicOffer?.university?.name;
        const career = item.academicOffer?.career?.name;
        const photo = item.photos?.[0] || null;

        return (
            <TouchableOpacity
                style={s.resultRow}
                activeOpacity={0.7}
                onPress={() => nav.navigate('UserDetail', { userId: item.id })}
            >
                <ZAvatar name={item.name} photo={photo} size={48} />
                <View style={s.resultInfo}>
                    <Text style={s.resultName}>{item.name}</Text>
                    {career && <Text style={s.resultSub}>{career}</Text>}
                    {uni && <Text style={s.resultMeta}>{uni}</Text>}
                </View>
                <Feather name="chevron-right" size={18} color={Colors.gray} />
            </TouchableOpacity>
        );
    };

    const renderGroup = ({ item }: { item: any }) => {
        const count = item.member_count || item.members?.length || 0;
        const typeMap: Record<string, string> = {
            carrera: 'Carrera', interes: 'Interés', estudio: 'Estudio', general: 'General',
        };

        return (
            <TouchableOpacity
                style={s.resultRow}
                activeOpacity={0.7}
                onPress={() => nav.navigate('GroupDetailModal', { groupId: item.id })}
            >
                <View style={s.groupIcon}>
                    <Ionicons name="people" size={22} color={Colors.primary} />
                </View>
                <View style={s.resultInfo}>
                    <Text style={s.resultName}>{item.name}</Text>
                    <Text style={s.resultSub}>
                        {typeMap[item.type] || 'General'} · {count} miembros
                    </Text>
                    {item.description && (
                        <Text style={s.resultMeta} numberOfLines={1}>{item.description}</Text>
                    )}
                </View>
                <Feather name="chevron-right" size={18} color={Colors.gray} />
            </TouchableOpacity>
        );
    };

    const renderEvent = ({ item }: { item: any }) => {
        const d = new Date(item.event_date);
        const dateStr = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        const timeStr = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        return (
            <TouchableOpacity
                style={s.resultRow}
                activeOpacity={0.7}
                onPress={() => nav.navigate('EventDetail', { eventId: item.id })}
            >
                <View style={s.eventDateBox}>
                    <Text style={s.eventDay}>{d.getDate()}</Text>
                    <Text style={s.eventMonth}>{d.toLocaleDateString('es-ES', { month: 'short' })}</Text>
                </View>
                <View style={s.resultInfo}>
                    <Text style={s.resultName}>{item.name}</Text>
                    <Text style={s.resultSub}>{timeStr}{item.location ? ` · ${item.location}` : ''}</Text>
                    {item.group && <Text style={s.resultMeta}>{item.group.name}</Text>}
                </View>
                <Feather name="chevron-right" size={18} color={Colors.gray} />
            </TouchableOpacity>
        );
    };

    const currentData = tab === 'users' ? users : tab === 'groups' ? groups : events;
    const currentRender = tab === 'users' ? renderUser : tab === 'groups' ? renderGroup : renderEvent;

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
                    <Feather name="arrow-left" size={24} color={Colors.text} />
                </TouchableOpacity>
                <View style={s.searchBar}>
                    <Feather name="search" size={18} color={Colors.gray} />
                    <TextInput
                        style={s.searchInput}
                        placeholder="Buscar usuarios, grupos, eventos..."
                        placeholderTextColor={Colors.gray}
                        value={query}
                        onChangeText={handleQuery}
                        autoFocus
                        returnKeyType="search"
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={() => { setQuery(''); setUsers([]); setGroups([]); setEvents([]); }}>
                            <Feather name="x" size={18} color={Colors.gray} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Tabs */}
            <View style={s.tabs}>
                {([
                    { key: 'users' as Tab, label: 'Personas', icon: 'user' as const },
                    { key: 'groups' as Tab, label: 'Grupos', icon: 'users' as const },
                    { key: 'events' as Tab, label: 'Eventos', icon: 'calendar' as const },
                ]).map(t => (
                    <TouchableOpacity
                        key={t.key}
                        style={[s.tab, tab === t.key && s.tabActive]}
                        onPress={() => handleTabChange(t.key)}
                    >
                        <Feather name={t.icon} size={15} color={tab === t.key ? '#FFF' : Colors.textSecondary} />
                        <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Results */}
            {loading ? (
                <View style={s.centered}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : query.length < 2 ? (
                <View style={s.centered}>
                    <Feather name="search" size={48} color={Colors.grayLight} />
                    <Text style={s.emptyTitle}>Busca en ZETA</Text>
                    <Text style={s.emptySub}>Escribe al menos 2 caracteres</Text>
                </View>
            ) : (
                <FlatList
                    data={currentData}
                    keyExtractor={item => item.id}
                    renderItem={currentRender}
                    contentContainerStyle={s.list}
                    ListEmptyComponent={() => (
                        <View style={s.centered}>
                            <Feather name="search" size={48} color={Colors.grayLight} />
                            <Text style={s.emptyTitle}>Sin resultados</Text>
                            <Text style={s.emptySub}>Prueba con otra búsqueda</Text>
                        </View>
                    )}
                />
            )}
        </View>
    );
};

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 12, paddingTop: 56, paddingBottom: 12,
        backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
    },
    backBtn: { padding: 4 },
    searchBar: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: Colors.background, borderRadius: 12,
        paddingHorizontal: 14, height: 44,
    },
    searchInput: { flex: 1, fontSize: 15, color: Colors.text },

    tabs: {
        flexDirection: 'row', paddingHorizontal: Spacing.screenPadding,
        paddingVertical: 10, backgroundColor: Colors.white, gap: 8,
    },
    tab: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 5, paddingVertical: 9, borderRadius: 12, backgroundColor: Colors.background,
    },
    tabActive: { backgroundColor: Colors.primary },
    tabText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
    tabTextActive: { color: '#FFF' },

    list: { paddingHorizontal: Spacing.screenPadding, paddingTop: 8, paddingBottom: 80 },

    resultRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: Colors.white, borderRadius: 12, padding: 14, marginBottom: 8,
    },
    resultInfo: { flex: 1 },
    resultName: { fontSize: 15, fontWeight: '600', color: Colors.text },
    resultSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
    resultMeta: { fontSize: 12, color: Colors.gray, marginTop: 1 },

    groupIcon: {
        width: 48, height: 48, borderRadius: 14,
        backgroundColor: `${Colors.primary}15`, justifyContent: 'center', alignItems: 'center',
    },

    eventDateBox: {
        width: 48, height: 52, borderRadius: 12,
        backgroundColor: `${Colors.primary}12`, justifyContent: 'center', alignItems: 'center',
    },
    eventDay: { fontSize: 18, fontWeight: '700', color: Colors.primary, lineHeight: 22 },
    eventMonth: { fontSize: 10, fontWeight: '600', color: Colors.primary, textTransform: 'uppercase' },

    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
    emptyTitle: { fontSize: 17, fontWeight: '600', color: Colors.text, marginTop: 14 },
    emptySub: { fontSize: 14, color: Colors.textSecondary, marginTop: 6 },
});
