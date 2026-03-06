// src/screens/events/EventDetailScreen.tsx
import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Alert,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { ZAvatar } from '../../components/ZAvatar';
import eventsService, { ZetaEvent, RsvpSummary } from '../../services/eventsService';
import { useAuth } from '../../context/AuthContext';

export const EventDetailScreen: React.FC = () => {
    const nav = useNavigation<any>();
    const route = useRoute<any>();
    const { user } = useAuth();
    const { eventId } = route.params;

    const [event, setEvent] = useState<ZetaEvent | null>(null);
    const [rsvp, setRsvp] = useState<RsvpSummary | null>(null);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        try {
            const [ev, rs] = await Promise.all([
                eventsService.getById(eventId),
                eventsService.getRsvp(eventId),
            ]);
            setEvent(ev);
            setRsvp(rs);
        } catch {
            Alert.alert('Error', 'No se pudo cargar el evento');
            nav.goBack();
        } finally {
            setLoading(false);
        }
    }, [eventId]);

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            loadData();
        }, [loadData])
    );

    const handleRsvp = async (status: 'going' | 'not_going') => {
        try {
            const summary = await eventsService.rsvp(eventId, status);
            setRsvp(summary);
        } catch {
            Alert.alert('Error', 'No se pudo registrar tu respuesta');
        }
    };

    if (loading || !event) {
        return (
            <View style={s.centered}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    const d = new Date(event.event_date);
    const dateStr = d.toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    const timeStr = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const isCreator = event.creator_id === user?.id;

    return (
        <View style={s.container}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
                    <Feather name="arrow-left" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={s.headerTitle}>Evento</Text>
                <View style={{ width: 32 }} />
            </View>

            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
                {/* Hero */}
                <View style={s.hero}>
                    <View style={s.heroIcon}>
                        <Ionicons name="calendar" size={40} color="#7C3AED" />
                    </View>
                    <Text style={s.heroName}>{event.name}</Text>
                    {event.description && (
                        <Text style={s.heroDesc}>{event.description}</Text>
                    )}
                </View>

                {/* Info */}
                <View style={s.section}>
                    <View style={s.infoRow}>
                        <View style={[s.infoIcon, { backgroundColor: '#EDE9FE' }]}>
                            <Ionicons name="time-outline" size={18} color="#7C3AED" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={s.infoLabel}>Fecha y hora</Text>
                            <Text style={s.infoValue}>{dateStr}</Text>
                            <Text style={s.infoValue}>{timeStr}</Text>
                        </View>
                    </View>

                    {event.location && (
                        <View style={s.infoRow}>
                            <View style={[s.infoIcon, { backgroundColor: '#DBEAFE' }]}>
                                <Ionicons name="location-outline" size={18} color="#2563EB" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.infoLabel}>Ubicación</Text>
                                <Text style={s.infoValue}>{event.location}</Text>
                            </View>
                        </View>
                    )}

                    {event.group && (
                        <TouchableOpacity
                            style={s.infoRow}
                            onPress={() => nav.navigate('GroupDetailModal', { groupId: event.group_id })}
                        >
                            <View style={[s.infoIcon, { backgroundColor: '#F0FDF4' }]}>
                                <Ionicons name="people-outline" size={18} color="#10B981" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.infoLabel}>Grupo</Text>
                                <Text style={s.infoValue}>{event.group.name}</Text>
                            </View>
                            <Feather name="chevron-right" size={18} color={Colors.gray} />
                        </TouchableOpacity>
                    )}

                    {event.creator && (
                        <View style={s.infoRow}>
                            <View style={[s.infoIcon, { backgroundColor: '#FEF3C7' }]}>
                                <Ionicons name="person-outline" size={18} color="#F59E0B" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.infoLabel}>Creado por</Text>
                                <Text style={s.infoValue}>{event.creator.name}</Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* RSVP action — solo no-creadores */}
                {!isCreator && rsvp && (
                    <View style={s.section}>
                        <Text style={s.sectionTitle}>¿Vas a asistir?</Text>
                        <View style={s.rsvpRow}>
                            <TouchableOpacity
                                style={[s.rsvpBtn, s.rsvpGoing, rsvp.my_status === 'going' && s.rsvpGoingActive]}
                                onPress={() => handleRsvp('going')}
                            >
                                <Ionicons
                                    name={rsvp.my_status === 'going' ? 'checkmark-circle' : 'checkmark-circle-outline'}
                                    size={20}
                                    color={rsvp.my_status === 'going' ? '#FFF' : '#10B981'}
                                />
                                <Text style={[s.rsvpText, rsvp.my_status === 'going' && s.rsvpTextActive]}>
                                    Iré
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[s.rsvpBtn, s.rsvpDecline, rsvp.my_status === 'not_going' && s.rsvpDeclineActive]}
                                onPress={() => handleRsvp('not_going')}
                            >
                                <Ionicons
                                    name={rsvp.my_status === 'not_going' ? 'close-circle' : 'close-circle-outline'}
                                    size={20}
                                    color={rsvp.my_status === 'not_going' ? '#FFF' : '#EF4444'}
                                />
                                <Text style={[s.rsvpText, { color: '#EF4444' }, rsvp.my_status === 'not_going' && s.rsvpTextActive]}>
                                    No iré
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Attendees */}
                {rsvp && (
                    <View style={s.section}>
                        <Text style={s.sectionTitle}>
                            Asistentes ({rsvp.going_count})
                        </Text>
                        {rsvp.going_users.length === 0 ? (
                            <Text style={s.emptyText}>Nadie ha confirmado aún</Text>
                        ) : (
                            rsvp.going_users.map(u => (
                                <TouchableOpacity
                                    key={u.id}
                                    style={s.attendeeRow}
                                    onPress={() => nav.navigate('UserDetail', { userId: u.id })}
                                >
                                    <ZAvatar name={u.name} photo={null} size={38} />
                                    <Text style={s.attendeeName}>{u.name}</Text>
                                    <Feather name="chevron-right" size={16} color={Colors.gray} />
                                </TouchableOpacity>
                            ))
                        )}

                        {rsvp.not_going_users.length > 0 && (
                            <>
                                <Text style={[s.sectionTitle, { marginTop: 16 }]}>
                                    No asistirán ({rsvp.not_going_count})
                                </Text>
                                {rsvp.not_going_users.map(u => (
                                    <View key={u.id} style={s.attendeeRow}>
                                        <ZAvatar name={u.name} photo={null} size={38} />
                                        <Text style={[s.attendeeName, { color: Colors.gray }]}>{u.name}</Text>
                                    </View>
                                ))}
                            </>
                        )}
                    </View>
                )}
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
    scroll: { paddingBottom: 80 },

    hero: {
        backgroundColor: Colors.white, padding: 24, alignItems: 'center',
        borderBottomWidth: 1, borderBottomColor: Colors.border,
    },
    heroIcon: {
        width: 80, height: 80, borderRadius: 24,
        backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    },
    heroName: { fontSize: 22, fontWeight: '700', color: Colors.text, textAlign: 'center' },
    heroDesc: {
        fontSize: 14, color: Colors.textSecondary, textAlign: 'center',
        marginTop: 8, lineHeight: 20, paddingHorizontal: 20,
    },

    section: {
        backgroundColor: Colors.white, marginHorizontal: Spacing.screenPadding,
        borderRadius: 14, padding: 16, marginTop: 10,
    },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12 },

    infoRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.background,
    },
    infoIcon: {
        width: 40, height: 40, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center',
    },
    infoLabel: { fontSize: 12, color: Colors.gray, fontWeight: '500' },
    infoValue: { fontSize: 14, fontWeight: '600', color: Colors.text, marginTop: 1, textTransform: 'capitalize' },

    rsvpRow: { flexDirection: 'row', gap: 10 },
    rsvpBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5,
    },
    rsvpGoing: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
    rsvpGoingActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
    rsvpDecline: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
    rsvpDeclineActive: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
    rsvpText: { fontSize: 15, fontWeight: '600', color: '#10B981' },
    rsvpTextActive: { color: '#FFF' },

    attendeeRow: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.background,
    },
    attendeeName: { flex: 1, fontSize: 14, fontWeight: '500', color: Colors.text },
    emptyText: { fontSize: 14, color: Colors.textSecondary },
});
