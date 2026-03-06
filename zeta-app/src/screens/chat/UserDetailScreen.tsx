// src/screens/chat/UserDetailScreen.tsx
// Detalle de usuario desde un chat directo
import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Alert, ActivityIndicator, Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { ZAvatar } from '../../components/ZAvatar';
import api from '../../services/api';

export const UserDetailScreen: React.FC = () => {
    const nav = useNavigation<any>();
    const route = useRoute<any>();
    const { user: me } = useAuth();

    const { userId, conversationId } = route.params;

    const [userProfile, setUserProfile] = useState<any>(null);
    const [commonGroups, setCommonGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [connStatus, setConnStatus] = useState<{ status: string; connection_id: string | null; is_sender?: boolean }>({ status: 'none', connection_id: null });
    const [connecting, setConnecting] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const [profileRes, myGroupsRes, connRes] = await Promise.all([
                api.get(`/users/${userId}`),
                api.get('/groups/me'),
                api.get(`/users/connections/status/${userId}`).catch(() => ({ data: { status: 'none', connection_id: null } })),
            ]);
            setUserProfile(profileRes.data);
            setConnStatus(connRes.data);

            // Buscar grupos en comun: obtener grupos del otro usuario
            try {
                // Los grupos del otro usuario no los podemos ver directamente,
                // pero podemos buscar entre mis grupos cuales tienen al otro como miembro
                const myGroups = myGroupsRes.data;
                const common: any[] = [];
                for (const g of myGroups) {
                    if (g.members?.some((m: any) => (m.user_id || m.id) === userId)) {
                        common.push(g);
                    }
                }
                setCommonGroups(common);
            } catch {
                setCommonGroups([]);
            }
        } catch (err) {
            console.error('Error cargando perfil:', err);
            Alert.alert('Error', 'No se pudo cargar el perfil');
            nav.goBack();
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const handleConnect = async () => {
        setConnecting(true);
        try {
            await api.post(`/users/connect/${userId}`);
            setConnStatus({ status: 'pending', connection_id: null, is_sender: true });
            Alert.alert('Solicitud enviada', 'El usuario recibirá tu solicitud de conexión.');
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.message || 'No se pudo enviar la solicitud');
        } finally {
            setConnecting(false);
        }
    };

    const handleClearChat = () => {
        Alert.alert(
            'Vaciar chat',
            'Se eliminaran todos los mensajes de esta conversacion. Esta accion no se puede deshacer.',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Vaciar', style: 'destructive', onPress: async () => {
                        try {
                            await api.delete(`/conversations/${conversationId}/messages`);
                            Alert.alert('Chat vaciado', 'Se han eliminado todos los mensajes.');
                        } catch {
                            Alert.alert('Error', 'No se pudo vaciar el chat');
                        }
                    }
                },
            ]
        );
    };

    const handleBlockUser = () => {
        Alert.alert(
            'Bloquear usuario',
            `Quieres bloquear a ${userProfile?.name}? No podra enviarte mensajes.`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Bloquear', style: 'destructive', onPress: () => {
                        // TODO: Implementar bloqueo en backend
                        Alert.alert('Bloqueado', `${userProfile?.name} ha sido bloqueado.`);
                    }
                },
            ]
        );
    };

    if (loading) {
        return (
            <View style={s.centered}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    if (!userProfile) return null;

    const photo = userProfile.photos?.[0] || null;
    const uni = userProfile.academicOffer?.university?.name;
    const career = userProfile.academicOffer?.career?.name;

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
                    <Feather name="arrow-left" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={s.headerTitle}>Perfil</Text>
                <View style={{ width: 32 }} />
            </View>

            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
                {/* Hero */}
                <View style={s.hero}>
                    <ZAvatar name={userProfile.name} photo={photo} size={90} />
                    <Text style={s.heroName}>{userProfile.name}</Text>
                    {career && (
                        <Text style={s.heroCareer}>{career}</Text>
                    )}
                    {uni && (
                        <Text style={s.heroUni}>{uni}</Text>
                    )}
                    {userProfile.year && (
                        <View style={s.yearBadge}>
                            <Text style={s.yearBadgeText}>{userProfile.year}o curso</Text>
                        </View>
                    )}
                </View>

                {/* Connect button */}
                {userId !== me?.id && (
                    <View style={s.connectSection}>
                        {connStatus.status === 'none' && (
                            <TouchableOpacity
                                style={s.connectBtn}
                                onPress={handleConnect}
                                disabled={connecting}
                            >
                                {connecting ? (
                                    <ActivityIndicator color="#FFF" size="small" />
                                ) : (
                                    <>
                                        <Feather name="user-plus" size={18} color="#FFF" />
                                        <Text style={s.connectBtnText}>Conectar</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}
                        {connStatus.status === 'pending' && connStatus.is_sender && (
                            <View style={s.pendingBtn}>
                                <Feather name="clock" size={18} color={Colors.primary} />
                                <Text style={s.pendingBtnText}>Solicitud enviada</Text>
                            </View>
                        )}
                        {connStatus.status === 'pending' && !connStatus.is_sender && (
                            <View style={s.pendingBtn}>
                                <Feather name="clock" size={18} color={Colors.primary} />
                                <Text style={s.pendingBtnText}>Solicitud pendiente</Text>
                            </View>
                        )}
                        {connStatus.status === 'accepted' && (
                            <View style={s.connectedBtn}>
                                <Feather name="check-circle" size={18} color="#10B981" />
                                <Text style={s.connectedBtnText}>Conectados</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Fotos */}
                {userProfile.photos && userProfile.photos.length > 1 && (
                    <View style={s.section}>
                        <Text style={s.sectionTitle}>Fotos</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={s.photosRow}>
                                {userProfile.photos.map((p: string, i: number) => (
                                    <Image key={i} source={{ uri: p }} style={s.photoThumb} />
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                )}

                {/* Intereses */}
                {userProfile.interests && userProfile.interests.length > 0 && (
                    <View style={s.section}>
                        <Text style={s.sectionTitle}>Intereses</Text>
                        <View style={s.chipsWrap}>
                            {userProfile.interests.map((i: any) => (
                                <View key={i.id} style={s.chip}>
                                    <Text style={s.chipText}>{i.icon} {i.name}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Grupos en comun */}
                <View style={s.section}>
                    <Text style={s.sectionTitle}>
                        Grupos en comun ({commonGroups.length})
                    </Text>
                    {commonGroups.length === 0 ? (
                        <Text style={s.emptyText}>Sin grupos en comun</Text>
                    ) : (
                        commonGroups.map(g => (
                            <TouchableOpacity
                                key={g.id}
                                style={s.groupRow}
                                onPress={() => nav.navigate('Grupos', {
                                    screen: 'GroupDetail',
                                    params: { groupId: g.id },
                                })}
                            >
                                <Feather name="users" size={18} color={Colors.primary} />
                                <View style={{ flex: 1 }}>
                                    <Text style={s.groupName}>{g.name}</Text>
                                    <Text style={s.groupMeta}>
                                        {g.member_count || g.members?.length || 0} miembros
                                    </Text>
                                </View>
                                <Feather name="chevron-right" size={18} color={Colors.gray} />
                            </TouchableOpacity>
                        ))
                    )}
                </View>

                {/* Opciones */}
                <View style={s.section}>
                    <Text style={s.sectionTitle}>Opciones</Text>

                    <TouchableOpacity style={s.optionRow} onPress={handleClearChat}>
                        <View style={[s.optionIcon, { backgroundColor: '#FEF3C7' }]}>
                            <Feather name="trash" size={18} color="#F59E0B" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={s.optionLabel}>Vaciar chat</Text>
                            <Text style={s.optionDesc}>Elimina todos los mensajes</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={s.optionRow} onPress={handleBlockUser}>
                        <View style={[s.optionIcon, { backgroundColor: '#FEE2E2' }]}>
                            <Feather name="slash" size={18} color="#EF4444" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[s.optionLabel, { color: '#EF4444' }]}>Bloquear usuario</Text>
                            <Text style={s.optionDesc}>No podra contactarte</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
};

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.screenPadding, paddingTop: 56, paddingBottom: 12,
        backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },

    scroll: { paddingBottom: 40 },

    // Hero
    hero: {
        backgroundColor: Colors.white, padding: 28, alignItems: 'center',
        borderBottomWidth: 1, borderBottomColor: Colors.border,
    },
    heroName: { fontSize: 24, fontWeight: '700', color: Colors.text, marginTop: 14 },
    heroCareer: { fontSize: 15, color: Colors.textSecondary, marginTop: 4 },
    heroUni: { fontSize: 13, color: Colors.gray, marginTop: 2 },
    yearBadge: {
        backgroundColor: `${Colors.primary}15`, paddingHorizontal: 12,
        paddingVertical: 4, borderRadius: 12, marginTop: 10,
    },
    yearBadgeText: { fontSize: 13, fontWeight: '600', color: Colors.primary },

    // Connect
    connectSection: {
        paddingHorizontal: Spacing.screenPadding, paddingVertical: 14,
        backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
    },
    connectBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: Colors.primary, paddingVertical: 13, borderRadius: 12,
    },
    connectBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
    pendingBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        borderWidth: 1.5, borderColor: Colors.primary, paddingVertical: 13, borderRadius: 12,
        backgroundColor: `${Colors.primary}08`,
    },
    pendingBtnText: { fontSize: 16, fontWeight: '600', color: Colors.primary },
    connectedBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        borderWidth: 1.5, borderColor: '#10B981', paddingVertical: 13, borderRadius: 12,
        backgroundColor: '#F0FDF4',
    },
    connectedBtnText: { fontSize: 16, fontWeight: '600', color: '#10B981' },

    // Photos
    photosRow: { flexDirection: 'row', gap: 10 },
    photoThumb: { width: 80, height: 100, borderRadius: 12 },

    // Section
    section: {
        backgroundColor: Colors.white, marginHorizontal: Spacing.screenPadding,
        marginTop: 12, borderRadius: 14, padding: 16,
    },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12 },

    // Chips
    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
        backgroundColor: `${Colors.primary}12`,
    },
    chipText: { fontSize: 13, color: Colors.primary, fontWeight: '500' },

    // Groups
    groupRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.background,
    },
    groupName: { fontSize: 14, fontWeight: '600', color: Colors.text },
    groupMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
    emptyText: { fontSize: 14, color: Colors.textSecondary },

    // Options
    optionRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.background,
    },
    optionIcon: {
        width: 38, height: 38, borderRadius: 10,
        justifyContent: 'center', alignItems: 'center',
    },
    optionLabel: { fontSize: 15, fontWeight: '600', color: Colors.text },
    optionDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
});
