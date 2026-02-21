// src/screens/Groups/GroupsScreen.tsx
// Lista de grupos: "Mis Grupos" y "Explorar"
import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    RefreshControl, ActivityIndicator, TextInput,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getGroups, getMyGroups, Group } from '../../services/groupService';
import { Colors } from '../../theme/index';

type Tab = 'my' | 'explore';

export default function GroupsScreen() {
    const navigation = useNavigation<any>();
    const { user } = useAuth();

    const [tab, setTab] = useState<Tab>('my');
    const [myGroups, setMyGroups] = useState<Group[]>([]);
    const [allGroups, setAllGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');

    const loadGroups = useCallback(async () => {
        try {
            const [my, all] = await Promise.all([getMyGroups(), getGroups()]);
            setMyGroups(my);
            setAllGroups(all);
        } catch (e) {
            console.error('Error cargando grupos:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // Recargar al volver a la pantalla
    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            loadGroups();
        }, [loadGroups])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadGroups();
    };

    // Filtrar por búsqueda
    const currentList = tab === 'my' ? myGroups : allGroups;
    const filtered = search.trim()
        ? currentList.filter(g =>
            g.name.toLowerCase().includes(search.toLowerCase()) ||
            g.description?.toLowerCase().includes(search.toLowerCase())
        )
        : currentList;

    // ── Helpers de UI ──
    const typeIcon = (type: string) => {
        switch (type) {
            case 'carrera': return 'school-outline';
            case 'interes': return 'heart-outline';
            case 'estudio': return 'book-outline';
            default: return 'people-outline';
        }
    };

    const typeLabel = (type: string) => {
        switch (type) {
            case 'carrera': return 'Carrera';
            case 'interes': return 'Interés';
            case 'estudio': return 'Estudio';
            default: return 'General';
        }
    };

    const renderGroupCard = ({ item }: { item: Group }) => {
        const memberCount = item.member_count || item.members?.length || 0;
        const isMember = item.is_member ||
            item.members?.some(m => m.user_id === user?.id);

        return (
            <TouchableOpacity
                style={s.card}
                onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
                activeOpacity={0.7}
            >
                {/* Icono del tipo */}
                <View style={[s.cardIcon, { backgroundColor: Colors.primary + '15' }]}>
                    <Ionicons name={typeIcon(item.type)} size={28} color={Colors.primary} />
                </View>

                <View style={s.cardContent}>
                    <View style={s.cardHeader}>
                        <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
                        {isMember && (
                            <View style={s.memberBadge}>
                                <Text style={s.memberBadgeText}>Miembro</Text>
                            </View>
                        )}
                    </View>

                    {item.description && (
                        <Text style={s.cardDesc} numberOfLines={2}>{item.description}</Text>
                    )}

                    <View style={s.cardMeta}>
                        <View style={s.metaItem}>
                            <Ionicons name="people" size={14} color="#999" />
                            <Text style={s.metaText}>{memberCount} miembros</Text>
                        </View>
                        <View style={s.metaItem}>
                            <Ionicons name="pricetag-outline" size={14} color="#999" />
                            <Text style={s.metaText}>{typeLabel(item.type)}</Text>
                        </View>
                        {item.privacy !== 'public' && (
                            <View style={s.metaItem}>
                                <Ionicons name="lock-closed-outline" size={14} color="#999" />
                                <Text style={s.metaText}>
                                    {item.privacy === 'private' ? 'Privado' : 'Universidad'}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                <Ionicons name="chevron-forward" size={20} color="#CCC" />
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={s.center}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <Text style={s.title}>Grupos</Text>
                <TouchableOpacity
                    style={s.createBtn}
                    onPress={() => navigation.navigate('CreateGroup')}
                >
                    <Ionicons name="add" size={22} color="#FFF" />
                </TouchableOpacity>
            </View>

            {/* Buscador */}
            <View style={s.searchBox}>
                <Ionicons name="search" size={18} color="#999" />
                <TextInput
                    style={s.searchInput}
                    placeholder="Buscar grupos..."
                    placeholderTextColor="#999"
                    value={search}
                    onChangeText={setSearch}
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')}>
                        <Ionicons name="close-circle" size={18} color="#999" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Tabs */}
            <View style={s.tabs}>
                <TouchableOpacity
                    style={[s.tab, tab === 'my' && s.tabActive]}
                    onPress={() => setTab('my')}
                >
                    <Text style={[s.tabText, tab === 'my' && s.tabTextActive]}>
                        Mis Grupos ({myGroups.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[s.tab, tab === 'explore' && s.tabActive]}
                    onPress={() => setTab('explore')}
                >
                    <Text style={[s.tabText, tab === 'explore' && s.tabTextActive]}>
                        Explorar ({allGroups.length})
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Lista */}
            <FlatList
                data={filtered}
                keyExtractor={item => item.id}
                renderItem={renderGroupCard}
                contentContainerStyle={s.list}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
                }
                ListEmptyComponent={
                    <View style={s.empty}>
                        <Ionicons
                            name={tab === 'my' ? 'people-outline' : 'compass-outline'}
                            size={48}
                            color="#CCC"
                        />
                        <Text style={s.emptyTitle}>
                            {tab === 'my' ? 'Aún no te has unido a ningún grupo' : 'No hay grupos disponibles'}
                        </Text>
                        <Text style={s.emptyDesc}>
                            {tab === 'my'
                                ? 'Explora grupos o crea el tuyo propio'
                                : 'Sé el primero en crear uno'}
                        </Text>
                        {tab === 'my' && (
                            <TouchableOpacity
                                style={s.emptyBtn}
                                onPress={() => setTab('explore')}
                            >
                                <Text style={s.emptyBtnText}>Explorar grupos</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                }
            />
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FA' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Header
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12,
        backgroundColor: '#FFF',
    },
    title: { fontSize: 28, fontWeight: '700', color: '#212121' },
    createBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: Colors.primary,
        justifyContent: 'center', alignItems: 'center',
    },

    // Search
    searchBox: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 12,
        borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
        borderWidth: 1, borderColor: '#E0E0E0',
    },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: '#212121' },

    // Tabs
    tabs: {
        flexDirection: 'row', marginHorizontal: 16,
        marginTop: 12, marginBottom: 8,
    },
    tab: {
        flex: 1, paddingVertical: 10, alignItems: 'center',
        borderBottomWidth: 2, borderBottomColor: 'transparent',
    },
    tabActive: { borderBottomColor: Colors.primary },
    tabText: { fontSize: 14, fontWeight: '500', color: '#999' },
    tabTextActive: { color: Colors.primary, fontWeight: '600' },

    // List
    list: { paddingHorizontal: 16, paddingBottom: 100 },

    // Card
    card: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FFF', borderRadius: 14, padding: 14,
        marginBottom: 10, borderWidth: 1, borderColor: '#F0F0F0',
    },
    cardIcon: {
        width: 52, height: 52, borderRadius: 14,
        justifyContent: 'center', alignItems: 'center', marginRight: 12,
    },
    cardContent: { flex: 1 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
    cardName: { fontSize: 16, fontWeight: '600', color: '#212121', flex: 1 },
    memberBadge: {
        backgroundColor: Colors.primary + '20', paddingHorizontal: 8,
        paddingVertical: 2, borderRadius: 8, marginLeft: 8,
    },
    memberBadgeText: { fontSize: 11, fontWeight: '600', color: Colors.primary },
    cardDesc: { fontSize: 13, color: '#666', marginBottom: 6, lineHeight: 18 },
    cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    metaText: { fontSize: 12, color: '#999' },

    // Empty
    empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
    emptyTitle: {
        fontSize: 17, fontWeight: '600', color: '#666', marginTop: 16, textAlign: 'center',
    },
    emptyDesc: {
        fontSize: 14, color: '#999', marginTop: 6, textAlign: 'center', lineHeight: 20,
    },
    emptyBtn: {
        marginTop: 20, backgroundColor: Colors.primary,
        paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12,
    },
    emptyBtnText: { color: '#FFF', fontWeight: '600', fontSize: 15 },
});