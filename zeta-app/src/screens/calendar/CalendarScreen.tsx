// =============================================
// src/screens/main/CalendarScreen.tsx
// Calendario mensual + lista de eventos del día
// =============================================
import React, { useState, useMemo, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList,
    TouchableOpacity, ActivityIndicator, RefreshControl,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, DateData } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useEvents, MarkedDates } from '../../hooks/useEvents';
import { ZetaEvent } from '../../services/eventsService';

// ── Helpers ──
const TODAY = new Date().toISOString().slice(0, 10);

const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
};

const formatDateHeader = (dateKey: string) => {
    const d = new Date(dateKey + 'T00:00:00');
    return d.toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long',
    });
};

// ── Componente tarjeta de evento ──
const EventCard: React.FC<{ event: ZetaEvent }> = ({ event }) => (
    <View style={s.card}>
        <View style={s.cardTimeCol}>
            <Text style={s.cardTime}>{formatTime(event.event_date)}</Text>
        </View>
        <View style={s.cardAccent} />
        <View style={s.cardBody}>
            <Text style={s.cardTitle} numberOfLines={1}>{event.name}</Text>
            {event.group && (
                <View style={s.cardRow}>
                    <Ionicons name="people-outline" size={13} color={Colors.textSecondary} />
                    <Text style={s.cardSub}>{event.group.name}</Text>
                </View>
            )}
            {event.location && (
                <View style={s.cardRow}>
                    <Ionicons name="location-outline" size={13} color={Colors.textSecondary} />
                    <Text style={s.cardSub}>{event.location}</Text>
                </View>
            )}
            {event.description && (
                <Text style={s.cardDesc} numberOfLines={2}>{event.description}</Text>
            )}
        </View>
    </View>
);

// ── Pantalla principal ──
export const CalendarScreen: React.FC = () => {
    const insets = useSafeAreaInsets();
    const { byDate, markedDates, loading, error, refresh } = useEvents();
    const [selectedDate, setSelectedDate] = useState(TODAY);

    // Merge selected date highlight con los dots de eventos
    const mergedMarks = useMemo<MarkedDates>(() => ({
        ...markedDates,
        [selectedDate]: {
            ...(markedDates[selectedDate] || {}),
            selected: true,
            selectedColor: Colors.primary,
            marked: !!markedDates[selectedDate]?.marked,
            dotColor: '#FFFFFF',
        } as any,
    }), [markedDates, selectedDate]);

    const dayEvents = useMemo(
        () => byDate[selectedDate] || [],
        [byDate, selectedDate],
    );

    const onDayPress = useCallback((day: DateData) => {
        setSelectedDate(day.dateString);
    }, []);

    // ── Header del listado ──
    const ListHeader = () => (
        <View style={s.listHeader}>
            <Text style={s.listHeaderText}>
                {dayEvents.length > 0
                    ? formatDateHeader(selectedDate)
                    : 'Sin eventos este día'}
            </Text>
            {dayEvents.length > 0 && (
                <View style={s.badge}>
                    <Text style={s.badgeText}>{dayEvents.length}</Text>
                </View>
            )}
        </View>
    );

    // ── Empty state ──
    const EmptyDay = () => (
        <View style={s.empty}>
            <Ionicons name="calendar-outline" size={48} color={Colors.border} />
            <Text style={s.emptyText}>Día libre — ¡disfruta!</Text>
        </View>
    );

    if (loading) {
        return (
            <View style={s.center}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    if (error) {
        return (
            <View style={s.center}>
                <Ionicons name="alert-circle-outline" size={48} color="#E53935" />
                <Text style={s.errorText}>{error}</Text>
                <TouchableOpacity style={s.retryBtn} onPress={refresh}>
                    <Text style={s.retryText}>Reintentar</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={[s.container, { paddingTop: insets.top }]}>
            {/* ── Título de pantalla ── */}
            <View style={s.screenHeader}>
                <Text style={s.screenTitle}>Calendario</Text>
            </View>

            {/* ── Calendario mensual ── */}
            <Calendar
                current={TODAY}
                onDayPress={onDayPress}
                markedDates={mergedMarks}
                markingType="dot"
                enableSwipeMonths
                theme={{
                    backgroundColor: Colors.background,
                    calendarBackground: Colors.background,
                    // Header del mes
                    monthTextColor: Colors.text,
                    textMonthFontWeight: '700',
                    textMonthFontSize: 18,
                    // Flechas navegación
                    arrowColor: Colors.primary,
                    // Días
                    dayTextColor: Colors.text,
                    textDayFontSize: 15,
                    textDayFontWeight: '500',
                    // Día seleccionado
                    selectedDayBackgroundColor: Colors.primary,
                    selectedDayTextColor: '#FFFFFF',
                    // Hoy
                    todayTextColor: Colors.primary,
                    todayBackgroundColor: 'rgba(2,152,209,0.08)',
                    // Días fuera del mes
                    textDisabledColor: '#BDBDBD',
                    // Nombres días semana
                    textSectionTitleColor: Colors.textSecondary,
                    textDayHeaderFontWeight: '600',
                    textDayHeaderFontSize: 13,
                }}
                style={s.calendar}
            />

            {/* ── Separador ── */}
            <View style={s.divider} />

            {/* ── Lista de eventos del día seleccionado ── */}
            <FlatList
                data={dayEvents}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <EventCard event={item} />}
                ListHeaderComponent={ListHeader}
                ListEmptyComponent={EmptyDay}
                contentContainerStyle={s.list}
                refreshControl={
                    <RefreshControl
                        refreshing={loading}
                        onRefresh={refresh}
                        tintColor={Colors.primary}
                        colors={[Colors.primary]}
                    />
                }
            />
        </View>
    );
};

// ── Estilos ──
const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },

    // Header pantalla
    screenHeader: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
    },
    screenTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: Colors.text,
    },

    // Calendario
    calendar: {
        borderBottomWidth: 0,
        paddingBottom: 8,
    },
    divider: {
        height: 1,
        backgroundColor: Colors.border || '#E0E0E0',
        marginHorizontal: 16,
    },

    // Lista
    list: { paddingHorizontal: 16, paddingBottom: 100 },
    listHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
    },
    listHeaderText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
        textTransform: 'capitalize',
    },
    badge: {
        backgroundColor: Colors.primary,
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    badgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

    // Tarjeta evento
    card: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        // Sombra sutil
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    cardTimeCol: { width: 50, justifyContent: 'center', alignItems: 'center' },
    cardTime: { fontSize: 13, fontWeight: '700', color: Colors.primary },
    cardAccent: {
        width: 3,
        borderRadius: 2,
        backgroundColor: Colors.primary,
        marginHorizontal: 10,
    },
    cardBody: { flex: 1 },
    cardTitle: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 4 },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
    cardSub: { fontSize: 12, color: Colors.textSecondary },
    cardDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },

    // Empty
    empty: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { fontSize: 14, color: Colors.textSecondary, marginTop: 12 },

    // Error
    errorText: { fontSize: 14, color: '#E53935', marginTop: 12, textAlign: 'center' },
    retryBtn: {
        marginTop: 16,
        paddingHorizontal: 24,
        paddingVertical: 10,
        backgroundColor: Colors.primary,
        borderRadius: 8,
    },
    retryText: { color: '#FFF', fontWeight: '600' },
});