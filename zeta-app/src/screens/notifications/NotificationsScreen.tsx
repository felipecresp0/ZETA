// src/screens/notifications/NotificationsScreen.tsx
import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, SectionList, TouchableOpacity,
    ActivityIndicator, Alert,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { ZAvatar } from '../../components/ZAvatar';
import api from '../../services/api';

interface AppNotification {
    id: string;
    type: string;
    title: string;
    body: string;
    data: Record<string, any>;
    read: boolean;
    created_at: string;
}

interface PendingConnection {
    id: string;
    sender_id: string;
    sender: {
        id: string;
        name: string;
        photos?: string[];
        academicOffer?: any;
    };
    created_at: string;
}

export const NotificationsScreen: React.FC = () => {
    const nav = useNavigation<any>();
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [connections, setConnections] = useState<PendingConnection[]>([]);
    const [loading, setLoading] = useState(true);
    const [responding, setResponding] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            const [notifRes, connRes] = await Promise.all([
                api.get('/notifications'),
                api.get('/users/connections/pending'),
            ]);
            setNotifications(notifRes.data);
            setConnections(connRes.data);
        } catch {
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            loadData();
            // Marcar todas como leidas al entrar
            api.post('/notifications/read-all').catch(() => {});
        }, [loadData])
    );

    const handleRespond = async (connId: string, action: 'accept' | 'reject') => {
        setResponding(connId);
        try {
            await api.post(`/users/connect/${connId}/${action}`);
            setConnections(prev => prev.filter(c => c.id !== connId));
            if (action === 'accept') {
                Alert.alert('Conectados', 'Ahora podeis hablar por chat.');
            }
        } catch {
            Alert.alert('Error', 'No se pudo procesar la solicitud');
        } finally {
            setResponding(null);
        }
    };

    const handleNotifPress = async (notif: AppNotification) => {
        // Borrar la notificación al pulsarla (marcarla como vista)
        try {
            await api.delete(`/notifications/${notif.id}`);
            setNotifications(prev => prev.filter(n => n.id !== notif.id));
        } catch {}

        switch (notif.type) {
            case 'match':
                nav.navigate('Main', { screen: 'Match' });
                break;
            case 'event_rsvp':
                if (notif.data?.eventId) {
                    nav.navigate('EventDetail', { eventId: notif.data.eventId });
                }
                break;
            case 'group_joined':
                if (notif.data?.groupId) {
                    nav.navigate('GroupDetailModal', { groupId: notif.data.groupId });
                }
                break;
            case 'connection_accepted':
                if (notif.data?.userId) {
                    nav.navigate('UserDetail', { userId: notif.data.userId });
                }
                break;
            case 'connection_request':
                if (notif.data?.senderId) {
                    nav.navigate('UserDetail', { userId: notif.data.senderId });
                }
                break;
            case 'task_created':
                nav.navigate('Main', { screen: 'UNI' });
                break;
        }
    };

    const handleDeleteAll = () => {
        Alert.alert('Borrar notificaciones', 'Eliminar todas las notificaciones?', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Borrar todas', style: 'destructive', onPress: async () => {
                    try {
                        await api.delete('/notifications/all');
                        setNotifications([]);
                    } catch {
                        Alert.alert('Error', 'No se pudieron borrar');
                    }
                },
            },
        ]);
    };

    const getNotifIcon = (type: string): { name: string; bg: string; color: string } => {
        switch (type) {
            case 'match':
                return { name: 'heart', bg: '#FCE4EC', color: '#E91E63' };
            case 'event_rsvp':
                return { name: 'calendar', bg: '#EDE9FE', color: '#7C3AED' };
            case 'group_joined':
                return { name: 'people', bg: '#DBEAFE', color: '#2563EB' };
            case 'connection_accepted':
                return { name: 'checkmark-circle', bg: '#D1FAE5', color: '#10B981' };
            case 'connection_request':
                return { name: 'person-add', bg: '#FEF3C7', color: '#F59E0B' };
            case 'task_created':
                return { name: 'checkmark-done', bg: '#D1FAE5', color: '#10B981' };
            default:
                return { name: 'notifications', bg: '#F3F4F6', color: '#6B7280' };
        }
    };

    // Filtrar notificaciones que no sean connection_request (esas se muestran como tarjetas aparte)
    const generalNotifs = notifications.filter(n => n.type !== 'connection_request');

    const sections: { title: string; data: any[]; type: 'connections' | 'notifications' }[] = [];

    if (connections.length > 0) {
        sections.push({
            title: `Solicitudes de conexion (${connections.length})`,
            data: connections,
            type: 'connections',
        });
    }

    if (generalNotifs.length > 0) {
        sections.push({
            title: 'Actividad reciente',
            data: generalNotifs,
            type: 'notifications',
        });
    }

    if (loading) {
        return (
            <View style={s.centered}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <View style={s.container}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
                    <Feather name="arrow-left" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={s.headerTitle}>Notificaciones</Text>
                {generalNotifs.length > 0 ? (
                    <TouchableOpacity onPress={handleDeleteAll} style={s.deleteAllBtn}>
                        <Feather name="trash-2" size={18} color={Colors.error} />
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 32 }} />
                )}
            </View>

            {sections.length === 0 ? (
                <View style={s.empty}>
                    <Feather name="bell-off" size={48} color={Colors.grayLight} />
                    <Text style={s.emptyTitle}>Sin notificaciones</Text>
                    <Text style={s.emptySub}>Las novedades apareceran aqui</Text>
                </View>
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={s.list}
                    stickySectionHeadersEnabled={false}
                    renderSectionHeader={({ section }) => (
                        <Text style={s.sectionTitle}>{section.title}</Text>
                    )}
                    renderItem={({ item, section }) => {
                        if (section.type === 'connections') {
                            const conn = item as PendingConnection;
                            const photo = conn.sender?.photos?.[0] || null;
                            const uni = conn.sender?.academicOffer?.university?.name;
                            const timeAgo = formatTimeAgo(conn.created_at);
                            const isResponding = responding === conn.id;

                            return (
                                <View style={s.card}>
                                    <TouchableOpacity
                                        style={s.cardTop}
                                        onPress={() => nav.navigate('UserDetail', { userId: conn.sender_id })}
                                        activeOpacity={0.7}
                                    >
                                        <ZAvatar name={conn.sender?.name || 'U'} photo={photo} size={50} />
                                        <View style={s.cardInfo}>
                                            <Text style={s.cardName}>{conn.sender?.name}</Text>
                                            {uni && <Text style={s.cardSub}>{uni}</Text>}
                                            <Text style={s.cardTime}>Quiere conectar · {timeAgo}</Text>
                                        </View>
                                    </TouchableOpacity>
                                    <View style={s.cardActions}>
                                        <TouchableOpacity
                                            style={s.rejectBtn}
                                            onPress={() => handleRespond(conn.id, 'reject')}
                                            disabled={isResponding}
                                        >
                                            <Text style={s.rejectBtnText}>Rechazar</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[s.acceptBtn, isResponding && { opacity: 0.6 }]}
                                            onPress={() => handleRespond(conn.id, 'accept')}
                                            disabled={isResponding}
                                        >
                                            {isResponding ? (
                                                <ActivityIndicator color="#FFF" size="small" />
                                            ) : (
                                                <Text style={s.acceptBtnText}>Aceptar</Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        }

                        // Notificacion general
                        const notif = item as AppNotification;
                        const icon = getNotifIcon(notif.type);
                        const timeAgo = formatTimeAgo(notif.created_at);

                        return (
                            <TouchableOpacity
                                style={[s.notifRow, !notif.read && s.notifUnread]}
                                onPress={() => handleNotifPress(notif)}
                                activeOpacity={0.7}
                            >
                                <View style={[s.notifIcon, { backgroundColor: icon.bg }]}>
                                    <Ionicons name={icon.name as any} size={20} color={icon.color} />
                                </View>
                                <View style={s.notifContent}>
                                    <Text style={s.notifTitle}>{notif.title}</Text>
                                    <Text style={s.notifBody}>{notif.body}</Text>
                                    <Text style={s.notifTime}>{timeAgo}</Text>
                                </View>
                                <Feather name="chevron-right" size={16} color={Colors.gray} />
                            </TouchableOpacity>
                        );
                    }}
                />
            )}
        </View>
    );
};

const formatTimeAgo = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diff < 1) return 'ahora';
    if (diff < 60) return `hace ${diff} min`;
    if (diff < 1440) return `hace ${Math.floor(diff / 60)}h`;
    if (diff < 2880) return 'ayer';
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
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
    deleteAllBtn: { padding: 4 },

    list: { padding: Spacing.screenPadding, paddingBottom: 80 },

    sectionTitle: {
        fontSize: 16, fontWeight: '700', color: Colors.text,
        marginTop: 16, marginBottom: 10,
    },

    // Connection cards
    card: {
        backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 10,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    cardInfo: { flex: 1 },
    cardName: { fontSize: 16, fontWeight: '600', color: Colors.text },
    cardSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
    cardTime: { fontSize: 12, color: Colors.gray, marginTop: 2 },
    cardActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
    rejectBtn: {
        flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
        borderWidth: 1.5, borderColor: Colors.border,
    },
    rejectBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
    acceptBtn: {
        flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
        backgroundColor: Colors.primary,
    },
    acceptBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },

    // Notification rows
    notifRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: Colors.white, borderRadius: 12, padding: 14, marginBottom: 8,
    },
    notifUnread: {
        borderLeftWidth: 3, borderLeftColor: Colors.primary,
    },
    notifIcon: {
        width: 44, height: 44, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center',
    },
    notifContent: { flex: 1 },
    notifTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
    notifBody: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
    notifTime: { fontSize: 11, color: Colors.gray, marginTop: 4 },

    // Empty
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
    emptyTitle: { fontSize: 17, fontWeight: '600', color: Colors.text, marginTop: 14 },
    emptySub: { fontSize: 14, color: Colors.textSecondary, marginTop: 6, textAlign: 'center' },
});
