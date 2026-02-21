// src/screens/Groups/GroupDetailScreen.tsx
// Detalle de un grupo: info, miembros, acciones (unirse/salir/chat)
import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Alert, ActivityIndicator, FlatList, Image,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import {
    getGroupById, joinGroup, leaveGroup,
    getGroupMembers, Group, GroupMember,
} from '../../services/groupService';
import api from '../../services/api';
import { Colors } from '../../theme/colors';

export default function GroupDetailScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { user } = useAuth();
    const { groupId } = route.params;

    const [group, setGroup] = useState<Group | null>(null);
    const [members, setMembers] = useState<GroupMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const [g, m] = await Promise.all([
                getGroupById(groupId),
                getGroupMembers(groupId),
            ]);
            setGroup(g);
            setMembers(m);
        } catch (e) {
            console.error('Error cargando grupo:', e);
            Alert.alert('Error', 'No se pudo cargar el grupo');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    }, [groupId]);

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            loadData();
        }, [loadData])
    );

    // ── Estado derivado ──
    // El backend devuelve miembros como {id, name, photo, role} donde id = user_id
    const isMember = members.some(m => (m.user_id || m.id) === user?.id);
    const myMembership = members.find(m => (m.user_id || m.id) === user?.id);
    const isAdmin = myMembership?.role === 'admin';
    const isCreator = group?.creator_id === user?.id;

    // ── Acciones ──
    const handleJoin = async () => {
        setActionLoading(true);
        try {
            await joinGroup(groupId);
            await loadData();
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleLeave = () => {
        if (isCreator) {
            Alert.alert('No puedes salir', 'Eres el creador del grupo. Transfiere la administración antes de salir.');
            return;
        }
        Alert.alert('Salir del grupo', `¿Seguro que quieres salir de "${group?.name}"?`, [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Salir', style: 'destructive',
                onPress: async () => {
                    setActionLoading(true);
                    try {
                        await leaveGroup(groupId);
                        navigation.goBack();
                    } catch (e: any) {
                        Alert.alert('Error', e.message);
                    } finally {
                        setActionLoading(false);
                    }
                },
            },
        ]);
    };

    const handleOpenChat = async () => {
        try {
            // Buscar/crear la conversación del grupo via API
            const { data } = await api.get(`/conversations/group/${groupId}`);

            // Navegar al tab de Chat y luego a la conversación
            navigation.navigate('Chat', {
                screen: 'ChatDetail',
                params: {
                    conversationId: data.id,
                    title: group?.name,
                    type: 'group',
                    participantIds: members.map(m => m.user_id || m.id),
                },
            });
        } catch (e: any) {
            console.error('Error abriendo chat:', e);
            Alert.alert('Error', 'No se pudo abrir el chat del grupo');
        }
    };

    // ── Helper UI ──
    const typeIcon = (type: string) => {
        switch (type) {
            case 'carrera': return 'school-outline';
            case 'interes': return 'heart-outline';
            case 'estudio': return 'book-outline';
            default: return 'people-outline';
        }
    };

    const formatDate = (date: string) =>
        new Date(date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

    if (loading) {
        return (
            <View style={s.center}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    if (!group) return null;

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#212121" />
                </TouchableOpacity>
                <Text style={s.headerTitle} numberOfLines={1}>{group.name}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
                {/* Hero */}
                <View style={s.hero}>
                    <View style={s.heroIcon}>
                        <Ionicons name={typeIcon(group.type) as any} size={40} color={Colors.primary} />
                    </View>
                    <Text style={s.heroName}>{group.name}</Text>
                    {group.description && (
                        <Text style={s.heroDesc}>{group.description}</Text>
                    )}

                    <View style={s.heroStats}>
                        <View style={s.stat}>
                            <Text style={s.statNumber}>{members.length}</Text>
                            <Text style={s.statLabel}>Miembros</Text>
                        </View>
                        <View style={s.statDivider} />
                        <View style={s.stat}>
                            <Text style={s.statNumber}>
                                {group.type === 'carrera' ? 'Carrera' :
                                    group.type === 'interes' ? 'Interés' :
                                        group.type === 'estudio' ? 'Estudio' : 'General'}
                            </Text>
                            <Text style={s.statLabel}>Tipo</Text>
                        </View>
                        <View style={s.statDivider} />
                        <View style={s.stat}>
                            <Text style={s.statNumber}>
                                {group.privacy === 'public' ? 'Público' :
                                    group.privacy === 'private' ? 'Privado' : 'Uni'}
                            </Text>
                            <Text style={s.statLabel}>Acceso</Text>
                        </View>
                    </View>

                    <Text style={s.createdDate}>
                        Creado el {formatDate(group.created_at)}
                    </Text>
                </View>

                {/* Acciones */}
                <View style={s.actions}>
                    {isMember ? (
                        <>
                            <TouchableOpacity style={s.actionBtn} onPress={handleOpenChat} activeOpacity={0.7}>
                                <Ionicons name="chatbubbles" size={20} color="#FFF" />
                                <Text style={s.actionBtnText}>Abrir Chat</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[s.actionBtn, s.leaveBtn]}
                                onPress={handleLeave}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="exit-outline" size={20} color="#E53935" />
                                <Text style={[s.actionBtnText, { color: '#E53935' }]}>Salir</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <TouchableOpacity
                            style={s.actionBtn}
                            onPress={handleJoin}
                            disabled={actionLoading}
                            activeOpacity={0.7}
                        >
                            {actionLoading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <>
                                    <Ionicons name="person-add" size={20} color="#FFF" />
                                    <Text style={s.actionBtnText}>Unirme al grupo</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                </View>

                {/* Miembros */}
                <View style={s.section}>
                    <Text style={s.sectionTitle}>
                        Miembros ({members.length})
                    </Text>
                    {members.map((m, idx) => {
                        // El backend puede devolver miembros como objetos planos
                        // con user como subobjeto o con los datos directamente
                        const memberUser = m.user || m;
                        const name = memberUser.name || 'Usuario';
                        const photo = memberUser.photo;
                        const email = memberUser.email || '';
                        const memberId = m.user_id || memberUser.id;

                        return (
                            <View key={m.id || idx} style={s.memberRow}>
                                <View style={s.avatar}>
                                    {photo ? (
                                        <Image source={{ uri: photo }} style={s.avatarImg} />
                                    ) : (
                                        <Text style={s.avatarText}>
                                            {name.charAt(0).toUpperCase()}
                                        </Text>
                                    )}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.memberName}>
                                        {name}
                                        {memberId === user?.id ? ' (tú)' : ''}
                                    </Text>
                                    {email ? <Text style={s.memberEmail}>{email}</Text> : null}
                                </View>
                                {m.role === 'admin' && (
                                    <View style={s.adminBadge}>
                                        <Text style={s.adminBadgeText}>Admin</Text>
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FA' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 60, paddingBottom: 14, paddingHorizontal: 16,
        backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#212121', flex: 1, textAlign: 'center' },

    scroll: { paddingBottom: 100 },

    // Hero
    hero: {
        backgroundColor: '#FFF', padding: 24, alignItems: 'center',
        borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    },
    heroIcon: {
        width: 80, height: 80, borderRadius: 24,
        backgroundColor: Colors.primary + '15',
        justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    },
    heroName: { fontSize: 22, fontWeight: '700', color: '#212121', textAlign: 'center' },
    heroDesc: {
        fontSize: 14, color: '#666', textAlign: 'center',
        marginTop: 8, lineHeight: 20, paddingHorizontal: 20,
    },
    heroStats: {
        flexDirection: 'row', marginTop: 20, alignItems: 'center',
    },
    stat: { alignItems: 'center', paddingHorizontal: 20 },
    statNumber: { fontSize: 16, fontWeight: '700', color: Colors.primary },
    statLabel: { fontSize: 12, color: '#999', marginTop: 2 },
    statDivider: { width: 1, height: 30, backgroundColor: '#E0E0E0' },
    createdDate: { fontSize: 12, color: '#BBB', marginTop: 16 },

    // Actions
    actions: {
        flexDirection: 'row', paddingHorizontal: 16,
        paddingVertical: 16, gap: 10,
    },
    actionBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, gap: 8,
    },
    actionBtnText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
    leaveBtn: {
        backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#E53935',
        flex: 0.5,
    },

    // Section
    section: {
        backgroundColor: '#FFF', marginHorizontal: 16,
        borderRadius: 14, padding: 16, marginTop: 8,
    },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#212121', marginBottom: 14 },

    // Members
    memberRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
    },
    avatar: {
        width: 42, height: 42, borderRadius: 21,
        backgroundColor: Colors.primary + '20',
        justifyContent: 'center', alignItems: 'center', marginRight: 12,
    },
    avatarImg: { width: 42, height: 42, borderRadius: 21 },
    avatarText: { fontSize: 16, fontWeight: '700', color: Colors.primary },
    memberName: { fontSize: 14, fontWeight: '600', color: '#333' },
    memberEmail: { fontSize: 12, color: '#999', marginTop: 1 },
    adminBadge: {
        backgroundColor: '#FFF3E0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    },
    adminBadgeText: { fontSize: 11, fontWeight: '600', color: '#E65100' },
});