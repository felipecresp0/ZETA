// src/screens/uni/UniScreen.tsx
// Pantalla unificada de gestion universitaria: Calendario + Eventos + Tareas
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, FlatList,
    RefreshControl, ActivityIndicator, TextInput, Alert,
    Animated, ScrollView, Modal, Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Calendar, DateData } from 'react-native-calendars';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { useEvents, MarkedDates } from '../../hooks/useEvents';
import eventsService, { ZetaEvent, ConflictAnalysis, CreateEventPayload } from '../../services/eventsService';
import tasksService, { Task, CreateTaskPayload } from '../../services/tasksService';
import { getMyGroups } from '../../services/groupService';

type Tab = 'calendar' | 'events' | 'tasks';

const TODAY = new Date().toISOString().slice(0, 10);

const PRIORITY_CONFIG = {
    urgent: { label: 'Urgente', color: '#EF4444', bg: '#FEE2E2' },
    high: { label: 'Alta', color: '#F59E0B', bg: '#FEF3C7' },
    medium: { label: 'Media', color: Colors.primary, bg: '#E0F2FE' },
    low: { label: 'Baja', color: '#6B7280', bg: '#F3F4F6' },
};

const STATUS_CONFIG = {
    pending: { label: 'Pendiente', icon: 'circle' as const },
    in_progress: { label: 'En curso', icon: 'clock' as const },
    completed: { label: 'Hecho', icon: 'check-circle' as const },
};

// ── Helpers ──
const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
};

const formatDateHeader = (dateKey: string) => {
    const d = new Date(dateKey + 'T00:00:00');
    return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
};

const formatDueDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.ceil((d.getTime() - now.getTime()) / 86400000);
    if (diff < 0) return 'Vencida';
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Manana';
    if (diff <= 7) return `En ${diff} dias`;
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

const isOverdue = (iso: string) => new Date(iso) < new Date();

// ══════════════════════════════════════════
export const UniScreen: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('calendar');

    // ── Calendar / Events state ──
    const { byDate, markedDates, loading: eventsLoading, refresh: refreshEvents, events } = useEvents();
    const [selectedDate, setSelectedDate] = useState(TODAY);

    // ── Tasks state ──
    const [tasks, setTasks] = useState<Task[]>([]);
    const [tasksLoading, setTasksLoading] = useState(true);
    const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'completed'>('all');
    const [showCreateTask, setShowCreateTask] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskSubject, setNewTaskSubject] = useState('');
    const [newTaskDueDate, setNewTaskDueDate] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [newTaskPriority, setNewTaskPriority] = useState<string | null>(null);
    const [creatingTask, setCreatingTask] = useState(false);
    const [aiPendingIds, setAiPendingIds] = useState<Set<string>>(new Set());

    // ── Conflicts IA state ──
    const [conflictsMap, setConflictsMap] = useState<Record<string, ConflictAnalysis>>({});
    const [conflictsLoading, setConflictsLoading] = useState(false);

    // ── Create event state ──
    const [showCreateEvent, setShowCreateEvent] = useState(false);
    const [newEventName, setNewEventName] = useState('');
    const [newEventDesc, setNewEventDesc] = useState('');
    const [newEventLocation, setNewEventLocation] = useState('');
    const [newEventDate, setNewEventDate] = useState('');
    const [newEventHour, setNewEventHour] = useState(12);
    const [newEventMinute, setNewEventMinute] = useState(0);
    const [newEventGroupId, setNewEventGroupId] = useState<string | null>(null);
    const [creatingEvent, setCreatingEvent] = useState(false);
    const [myGroups, setMyGroups] = useState<{ id: string; name: string }[]>([]);
    const [eventConflicts, setEventConflicts] = useState<ConflictAnalysis | null>(null);
    const [showEventConflicts, setShowEventConflicts] = useState(false);

    // ── Load tasks ──
    const loadTasks = useCallback(async () => {
        try {
            setTasksLoading(true);
            const data = await tasksService.getMyTasks();
            setTasks(data);
        } catch {
            console.error('Error cargando tareas');
        } finally {
            setTasksLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            refreshEvents();
            loadTasks();
            getMyGroups().then(g => setMyGroups(g.map(x => ({ id: x.id, name: x.name })))).catch(() => {});
        }, [])
    );

    // ── Cargar conflictos IA cuando hay eventos ──
    useEffect(() => {
        if (events.length === 0) return;
        const ids = events.map(e => e.id);
        setConflictsLoading(true);
        eventsService.checkBulkConflicts(ids)
            .then(results => {
                console.log('[UniScreen] Bulk conflicts response:', JSON.stringify(results).slice(0, 500));
                const map: Record<string, ConflictAnalysis> = {};
                results.forEach(r => {
                    if (r.has_conflicts) map[r.event_id] = r;
                });
                console.log('[UniScreen] Conflicts map keys:', Object.keys(map));
                setConflictsMap(map);
            })
            .catch(err => {
                console.error('[UniScreen] Error cargando conflictos:', err?.message || err);
            })
            .finally(() => setConflictsLoading(false));
    }, [events]);

    // ── Tasks agrupadas por fecha (YYYY-MM-DD) ──
    const tasksByDate = useMemo(() => {
        const map: Record<string, Task[]> = {};
        tasks.forEach(t => {
            if (!t.due_date) return;
            const key = t.due_date.slice(0, 10);
            if (!map[key]) map[key] = [];
            map[key].push(t);
        });
        return map;
    }, [tasks]);

    // ── Fechas con conflictos IA ──
    const conflictDates = useMemo(() => {
        const dates = new Set<string>();
        Object.keys(byDate).forEach(dateKey => {
            const eventsOnDay = byDate[dateKey];
            if (eventsOnDay.some(ev => conflictsMap[ev.id])) {
                dates.add(dateKey);
            }
        });
        return dates;
    }, [byDate, conflictsMap]);

    // ── Calendar marks (eventos = azul, tareas = naranja, conflictos = rojo) ──
    const mergedMarks = useMemo(() => {
        const allKeys = new Set([
            ...Object.keys(markedDates),
            ...Object.keys(tasksByDate),
        ]);
        const marks: Record<string, any> = {};
        allKeys.forEach(key => {
            const dots: { key: string; color: string }[] = [];
            if (markedDates[key]) dots.push({ key: 'event', color: '#0298D1' });
            if (tasksByDate[key]) dots.push({ key: 'task', color: '#F59E0B' });
            if (conflictDates.has(key)) dots.push({ key: 'conflict', color: '#EF4444' });
            marks[key] = { dots };
        });
        // Dia seleccionado
        marks[selectedDate] = {
            ...(marks[selectedDate] || {}),
            selected: true,
            selectedColor: Colors.primary,
        };
        return marks;
    }, [markedDates, tasksByDate, selectedDate, conflictDates]);

    const dayEvents = useMemo(() => byDate[selectedDate] || [], [byDate, selectedDate]);
    const dayTasks = useMemo(() => tasksByDate[selectedDate] || [], [tasksByDate, selectedDate]);

    // ── Task actions ──
    const toggleTaskStatus = async (task: Task) => {
        const newStatus = task.status === 'completed' ? 'pending' : 'completed';
        try {
            await tasksService.update(task.id, { status: newStatus });
            setTasks(prev => prev.map(t =>
                t.id === task.id ? { ...t, status: newStatus } : t
            ));
        } catch {
            Alert.alert('Error', 'No se pudo actualizar la tarea');
        }
    };

    const deleteTask = (task: Task) => {
        Alert.alert('Eliminar tarea', `Eliminar "${task.title}"?`, [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Eliminar', style: 'destructive', onPress: async () => {
                    try {
                        await tasksService.remove(task.id);
                        setTasks(prev => prev.filter(t => t.id !== task.id));
                    } catch {
                        Alert.alert('Error', 'No se pudo eliminar');
                    }
                }
            },
        ]);
    };

    const createTask = async () => {
        if (!newTaskTitle.trim() || !newTaskDueDate) return;
        setCreatingTask(true);
        try {
            const payload: CreateTaskPayload = {
                title: newTaskTitle.trim(),
                subject: newTaskSubject.trim() || undefined,
                due_date: newTaskDueDate.toISOString(),
                priority: newTaskPriority || undefined,
            };
            const created = await tasksService.create(payload);
            setTasks(prev => [created, ...prev]);
            setAiPendingIds(prev => new Set(prev).add(created.id));
            setNewTaskTitle('');
            setNewTaskSubject('');
            setNewTaskDueDate(null);
            setNewTaskPriority(null);
            setShowCreateTask(false);
            // Polling silencioso: reintenta hasta que n8n actualice la tarea
            const taskId = created.id;
            let attempts = 0;
            const poll = setInterval(async () => {
                attempts++;
                try {
                    const data = await tasksService.getMyTasks();
                    setTasks(data);
                    const updated = data.find(t => t.id === taskId);
                    if ((updated && updated.ai_pioritized) || attempts >= 5) {
                        clearInterval(poll);
                        setAiPendingIds(prev => {
                            const next = new Set(prev);
                            next.delete(taskId);
                            return next;
                        });
                    }
                } catch {
                    clearInterval(poll);
                }
            }, 3000);
        } catch {
            Alert.alert('Error', 'No se pudo crear la tarea');
        } finally {
            setCreatingTask(false);
        }
    };

    // ── Create event ──
    const createEvent = async () => {
        if (!newEventName.trim() || !newEventDate) return;
        setCreatingEvent(true);
        try {
            const hh = String(newEventHour).padStart(2, '0');
            const mm = String(newEventMinute).padStart(2, '0');
            const isoDate = new Date(`${newEventDate}T${hh}:${mm}:00`).toISOString();
            const payload: CreateEventPayload = {
                name: newEventName.trim(),
                description: newEventDesc.trim() || undefined,
                event_date: isoDate,
                location: newEventLocation.trim() || undefined,
                group_id: newEventGroupId || undefined,
            };
            const created = await eventsService.create(payload);
            setShowCreateEvent(false);
            setNewEventName('');
            setNewEventDesc('');
            setNewEventLocation('');
            setNewEventDate('');
            setNewEventHour(12);
            setNewEventMinute(0);
            setNewEventGroupId(null);
            refreshEvents();

            if (created.conflicts?.has_conflicts) {
                setEventConflicts(created.conflicts);
                setShowEventConflicts(true);
            }
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.message || 'No se pudo crear el evento');
        } finally {
            setCreatingEvent(false);
        }
    };

    const filteredTasks = useMemo(() => {
        if (taskFilter === 'all') return tasks.filter(t => t.status !== 'completed');
        if (taskFilter === 'completed') return tasks.filter(t => t.status === 'completed');
        return tasks.filter(t => t.status === taskFilter);
    }, [tasks, taskFilter]);

    // ── Stats ──
    const pendingCount = tasks.filter(t => t.status !== 'completed').length;
    const completedCount = tasks.filter(t => t.status === 'completed').length;
    const upcomingEventsCount = events.length;

    // ══════════════════════════════════════════
    //  TAB: CALENDAR
    // ══════════════════════════════════════════
    const renderCalendar = () => (
        <View style={{ flex: 1 }}>
            <Calendar
                current={TODAY}
                onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
                markedDates={mergedMarks}
                markingType="multi-dot"
                enableSwipeMonths
                theme={{
                    backgroundColor: Colors.background,
                    calendarBackground: Colors.white,
                    monthTextColor: Colors.text,
                    textMonthFontWeight: '700',
                    textMonthFontSize: 17,
                    arrowColor: Colors.primary,
                    dayTextColor: Colors.text,
                    textDayFontSize: 15,
                    textDayFontWeight: '500',
                    selectedDayBackgroundColor: Colors.primary,
                    selectedDayTextColor: '#FFF',
                    todayTextColor: Colors.primary,
                    todayBackgroundColor: 'rgba(2,152,209,0.08)',
                    textDisabledColor: '#BDBDBD',
                    textSectionTitleColor: Colors.textSecondary,
                    textDayHeaderFontWeight: '600',
                    textDayHeaderFontSize: 13,
                }}
                style={s.calendar}
            />
            <View style={s.divider} />
            <ScrollView contentContainerStyle={s.dayList}>
                <View style={s.dayHeader}>
                    <Text style={s.dayHeaderText}>
                        {(dayEvents.length > 0 || dayTasks.length > 0)
                            ? formatDateHeader(selectedDate)
                            : 'Sin eventos ni tareas este dia'}
                    </Text>
                    {(dayEvents.length + dayTasks.length) > 0 && (
                        <View style={s.dayBadge}>
                            <Text style={s.dayBadgeText}>{dayEvents.length + dayTasks.length}</Text>
                        </View>
                    )}
                </View>

                {dayEvents.length === 0 && dayTasks.length === 0 && (
                    <View style={s.emptyDay}>
                        <Feather name="sun" size={40} color={Colors.grayLight} />
                        <Text style={s.emptyDayText}>Dia libre</Text>
                    </View>
                )}

                {dayEvents.length > 0 && (
                    <>
                        <Text style={s.daySectionLabel}>Eventos</Text>
                        {dayEvents.map(ev => (
                            <EventCard key={ev.id} event={ev} conflict={conflictsMap[ev.id]} />
                        ))}
                        {/* Banner resumen conflictos IA del día */}
                        {dayEvents.some(ev => conflictsMap[ev.id]) && (
                            <View style={s.dayConflictBanner}>
                                <View style={s.dayConflictBannerHeader}>
                                    <Feather name="cpu" size={14} color="#7C3AED" />
                                    <Text style={s.dayConflictBannerTitle}>Análisis IA del día</Text>
                                </View>
                                {dayEvents
                                    .filter(ev => conflictsMap[ev.id])
                                    .map(ev => {
                                        const c = conflictsMap[ev.id];
                                        return (
                                            <View key={ev.id} style={s.dayConflictEntry}>
                                                <Text style={s.dayConflictEventName}>{ev.name}</Text>
                                                {c.conflicts.map((cf, i) => (
                                                    <View key={i} style={s.dayConflictRow}>
                                                        <Feather
                                                            name={cf.severity === 'high' ? 'alert-circle' : 'alert-triangle'}
                                                            size={12}
                                                            color={cf.severity === 'high' ? '#EF4444' : cf.severity === 'medium' ? '#F59E0B' : '#6B7280'}
                                                        />
                                                        <Text style={[
                                                            s.dayConflictText,
                                                            cf.severity === 'high' && { color: '#EF4444' },
                                                        ]}>{cf.description}</Text>
                                                    </View>
                                                ))}
                                                {c.recommendations.length > 0 && (
                                                    <View style={s.dayConflictRecommend}>
                                                        <Feather name="cpu" size={11} color="#7C3AED" />
                                                        <Text style={s.dayConflictRecommendText}>{c.recommendations[0]}</Text>
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    })
                                }
                            </View>
                        )}
                    </>
                )}

                {dayTasks.length > 0 && (
                    <>
                        <Text style={s.daySectionLabel}>Tareas</Text>
                        {dayTasks.map(t => (
                            <TaskCard
                                key={t.id}
                                task={t}
                                onToggle={() => toggleTaskStatus(t)}
                                onDelete={() => deleteTask(t)}
                                aiPending={aiPendingIds.has(t.id)}
                            />
                        ))}
                    </>
                )}
            </ScrollView>
        </View>
    );

    // ══════════════════════════════════════════
    //  TAB: EVENTS LIST
    // ══════════════════════════════════════════
    const renderEvents = () => (
        <View style={{ flex: 1 }}>
            <FlatList
                data={events}
                keyExtractor={item => item.id}
                renderItem={({ item }) => <EventCard event={item} showDate conflict={conflictsMap[item.id]} />}
                ListEmptyComponent={() => (
                    <View style={s.emptyState}>
                        <Feather name="calendar" size={48} color={Colors.grayLight} />
                        <Text style={s.emptyTitle}>Sin eventos proximos</Text>
                        <Text style={s.emptySub}>Crea un evento o unete a un grupo para ver eventos</Text>
                    </View>
                )}
                contentContainerStyle={s.listContent}
                refreshControl={
                    <RefreshControl refreshing={eventsLoading} onRefresh={refreshEvents} colors={[Colors.primary]} />
                }
            />
            <TouchableOpacity style={s.fab} onPress={() => setShowCreateEvent(true)} activeOpacity={0.8}>
                <Feather name="plus" size={26} color="#FFF" />
            </TouchableOpacity>
        </View>
    );

    // ══════════════════════════════════════════
    //  TAB: TASKS
    // ══════════════════════════════════════════
    const renderTasks = () => (
        <View style={{ flex: 1 }}>
            {/* Filter chips */}
            <View style={s.filterRow}>
                {([
                    { key: 'all', label: `Activas (${pendingCount})` },
                    { key: 'completed', label: `Hechas (${completedCount})` },
                ] as const).map(f => (
                    <TouchableOpacity
                        key={f.key}
                        style={[s.filterChip, taskFilter === f.key && s.filterChipActive]}
                        onPress={() => setTaskFilter(f.key)}
                    >
                        <Text style={[s.filterChipText, taskFilter === f.key && s.filterChipTextActive]}>
                            {f.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                data={filteredTasks}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <TaskCard
                        task={item}
                        onToggle={() => toggleTaskStatus(item)}
                        onDelete={() => deleteTask(item)}
                        aiPending={aiPendingIds.has(item.id)}
                    />
                )}
                ListEmptyComponent={() => (
                    <View style={s.emptyState}>
                        <Feather name="check-circle" size={48} color={Colors.grayLight} />
                        <Text style={s.emptyTitle}>
                            {taskFilter === 'completed' ? 'Sin tareas completadas' : 'Sin tareas pendientes'}
                        </Text>
                        <Text style={s.emptySub}>
                            {taskFilter === 'completed' ? 'Completa tareas para verlas aqui' : 'Pulsa + para crear una tarea'}
                        </Text>
                    </View>
                )}
                contentContainerStyle={s.listContent}
                refreshControl={
                    <RefreshControl refreshing={tasksLoading} onRefresh={loadTasks} colors={[Colors.primary]} />
                }
            />

            {/* FAB crear tarea */}
            <TouchableOpacity style={s.fab} onPress={() => setShowCreateTask(true)} activeOpacity={0.8}>
                <Feather name="plus" size={26} color="#FFF" />
            </TouchableOpacity>
        </View>
    );

    // ══════════════════════════════════════════
    //  MAIN RENDER
    // ══════════════════════════════════════════
    if (eventsLoading && tasksLoading) {
        return (
            <View style={s.centered}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <Text style={s.headerTitle}>UNI</Text>
                <View style={s.statsRow}>
                    <View style={s.statItem}>
                        <Feather name="calendar" size={14} color={Colors.primary} />
                        <Text style={s.statText}>{upcomingEventsCount} eventos</Text>
                    </View>
                    <View style={s.statDot} />
                    <View style={s.statItem}>
                        <Feather name="check-square" size={14} color={Colors.primary} />
                        <Text style={s.statText}>{pendingCount} tareas</Text>
                    </View>
                </View>
            </View>

            {/* Tabs */}
            <View style={s.tabs}>
                {([
                    { key: 'calendar' as Tab, label: 'Calendario', icon: 'calendar' as const },
                    { key: 'events' as Tab, label: 'Eventos', icon: 'list' as const },
                    { key: 'tasks' as Tab, label: 'Tareas', icon: 'check-square' as const },
                ]).map(tab => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[s.tab, activeTab === tab.key && s.tabActive]}
                        onPress={() => setActiveTab(tab.key)}
                    >
                        <Feather
                            name={tab.icon}
                            size={16}
                            color={activeTab === tab.key ? '#FFF' : Colors.textSecondary}
                        />
                        <Text style={[s.tabText, activeTab === tab.key && s.tabTextActive]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Content */}
            {activeTab === 'calendar' && renderCalendar()}
            {activeTab === 'events' && renderEvents()}
            {activeTab === 'tasks' && renderTasks()}

            {/* Modal crear tarea */}
            <Modal visible={showCreateTask} transparent animationType="slide">
                <View style={s.modalOverlay}>
                    <View style={s.modalContent}>
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>Nueva tarea</Text>
                            <TouchableOpacity onPress={() => setShowCreateTask(false)}>
                                <Feather name="x" size={24} color={Colors.text} />
                            </TouchableOpacity>
                        </View>

                        <Text style={s.modalLabel}>Titulo *</Text>
                        <TextInput
                            style={s.modalInput}
                            value={newTaskTitle}
                            onChangeText={setNewTaskTitle}
                            placeholder="Ej: Entregar informe BD"
                            placeholderTextColor={Colors.gray}
                            maxLength={100}
                        />

                        <Text style={s.modalLabel}>Asignatura</Text>
                        <TextInput
                            style={s.modalInput}
                            value={newTaskSubject}
                            onChangeText={setNewTaskSubject}
                            placeholder="Ej: Base de Datos"
                            placeholderTextColor={Colors.gray}
                            maxLength={60}
                        />

                        <Text style={s.modalLabel}>Fecha de entrega *</Text>
                        {Platform.OS === 'ios' ? (
                            <View style={[s.modalInput, s.dateRow]}>
                                <Feather name="calendar" size={16} color={Colors.primary} />
                                <DateTimePicker
                                    value={newTaskDueDate || new Date()}
                                    mode="date"
                                    display="compact"
                                    minimumDate={new Date()}
                                    locale="es-ES"
                                    accentColor={Colors.primary}
                                    onChange={(event: DateTimePickerEvent, date?: Date) => {
                                        if (date) setNewTaskDueDate(date);
                                    }}
                                />
                            </View>
                        ) : (
                            <>
                                <TouchableOpacity
                                    style={[s.modalInput, s.dateRow]}
                                    onPress={() => setShowDatePicker(true)}
                                >
                                    <Feather name="calendar" size={16} color={Colors.primary} />
                                    <Text style={{ fontSize: 15, color: newTaskDueDate ? Colors.text : Colors.gray }}>
                                        {newTaskDueDate
                                            ? newTaskDueDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
                                            : 'Selecciona una fecha'}
                                    </Text>
                                </TouchableOpacity>
                                {showDatePicker && (
                                    <DateTimePicker
                                        value={newTaskDueDate || new Date()}
                                        mode="date"
                                        minimumDate={new Date()}
                                        onChange={(event: DateTimePickerEvent, date?: Date) => {
                                            setShowDatePicker(false);
                                            if (date) setNewTaskDueDate(date);
                                        }}
                                    />
                                )}
                            </>
                        )}

                        <Text style={s.modalLabel}>Prioridad (opcional)</Text>
                        <View style={s.priorityRow}>
                            {(['low', 'medium', 'high', 'urgent'] as const).map(p => {
                                const cfg = PRIORITY_CONFIG[p];
                                const selected = newTaskPriority === p;
                                return (
                                    <TouchableOpacity
                                        key={p}
                                        style={[s.priorityChip, selected && { backgroundColor: cfg.color, borderColor: cfg.color }]}
                                        onPress={() => setNewTaskPriority(selected ? null : p)}
                                    >
                                        <Text style={[s.priorityChipText, selected && { color: '#FFF' }]}>
                                            {cfg.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        {!newTaskPriority && (
                            <View style={s.aiHintRow}>
                                <Feather name="cpu" size={13} color={Colors.primary} />
                                <Text style={s.aiHintText}>
                                    Si no seleccionas, la IA estimara la prioridad automaticamente
                                </Text>
                            </View>
                        )}

                        <TouchableOpacity
                            style={[s.modalBtn, (!newTaskTitle.trim() || !newTaskDueDate || creatingTask) && s.modalBtnDisabled]}
                            onPress={createTask}
                            disabled={!newTaskTitle.trim() || !newTaskDueDate || creatingTask}
                        >
                            {creatingTask ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={s.modalBtnText}>Crear tarea</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Modal crear evento */}
            <Modal visible={showCreateEvent} animationType="slide" transparent>
                <View style={s.eventModalOverlay}>
                    <View style={s.eventModalContent}>
                        <View style={s.eventModalHeader}>
                            <Text style={s.eventModalTitle}>Crear evento</Text>
                            <TouchableOpacity onPress={() => setShowCreateEvent(false)}>
                                <Feather name="x" size={24} color={Colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={s.eventModalBody} showsVerticalScrollIndicator={false}>
                            <Text style={s.eventModalLabel}>Nombre *</Text>
                            <TextInput
                                style={s.eventModalInput}
                                placeholder="Ej: Estudio grupal de cálculo"
                                placeholderTextColor={Colors.gray}
                                value={newEventName}
                                onChangeText={setNewEventName}
                                maxLength={100}
                            />

                            <Text style={s.eventModalLabel}>Descripción</Text>
                            <TextInput
                                style={[s.eventModalInput, { height: 70, textAlignVertical: 'top' }]}
                                placeholder="Detalles del evento..."
                                placeholderTextColor={Colors.gray}
                                value={newEventDesc}
                                onChangeText={setNewEventDesc}
                                multiline
                            />

                            <Text style={s.eventModalLabel}>Fecha *</Text>
                            <Calendar
                                minDate={new Date().toISOString().slice(0, 10)}
                                onDayPress={(day: DateData) => setNewEventDate(day.dateString)}
                                markedDates={newEventDate ? {
                                    [newEventDate]: { selected: true, selectedColor: '#7C3AED' },
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
                                style={s.eventModalCalendar}
                            />
                            {newEventDate ? (
                                <Text style={s.eventSelectedDateText}>
                                    {new Date(newEventDate + 'T00:00:00').toLocaleDateString('es-ES', {
                                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                                    })}
                                </Text>
                            ) : null}

                            <Text style={s.eventModalLabel}>Hora *</Text>
                            <View style={s.eTimePickerRow}>
                                <View style={s.eTimePickerCol}>
                                    <TouchableOpacity
                                        style={s.eTimeArrow}
                                        onPress={() => setNewEventHour(h => h < 23 ? h + 1 : 0)}
                                    >
                                        <Feather name="chevron-up" size={22} color={Colors.text} />
                                    </TouchableOpacity>
                                    <View style={s.eTimeDisplay}>
                                        <Text style={s.eTimeText}>{String(newEventHour).padStart(2, '0')}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={s.eTimeArrow}
                                        onPress={() => setNewEventHour(h => h > 0 ? h - 1 : 23)}
                                    >
                                        <Feather name="chevron-down" size={22} color={Colors.text} />
                                    </TouchableOpacity>
                                </View>
                                <Text style={s.eTimeSeparator}>:</Text>
                                <View style={s.eTimePickerCol}>
                                    <TouchableOpacity
                                        style={s.eTimeArrow}
                                        onPress={() => setNewEventMinute(m => m < 55 ? m + 5 : 0)}
                                    >
                                        <Feather name="chevron-up" size={22} color={Colors.text} />
                                    </TouchableOpacity>
                                    <View style={s.eTimeDisplay}>
                                        <Text style={s.eTimeText}>{String(newEventMinute).padStart(2, '0')}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={s.eTimeArrow}
                                        onPress={() => setNewEventMinute(m => m > 0 ? m - 5 : 55)}
                                    >
                                        <Feather name="chevron-down" size={22} color={Colors.text} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Quick time options */}
                            <View style={s.eQuickTimeRow}>
                                {[
                                    { label: '09:00', h: 9, m: 0 },
                                    { label: '12:00', h: 12, m: 0 },
                                    { label: '15:00', h: 15, m: 0 },
                                    { label: '18:00', h: 18, m: 0 },
                                    { label: '20:00', h: 20, m: 0 },
                                ].map(opt => {
                                    const isSelected = newEventHour === opt.h && newEventMinute === opt.m;
                                    return (
                                        <TouchableOpacity
                                            key={opt.label}
                                            style={[s.eQuickTimeChip, isSelected && s.eQuickTimeChipActive]}
                                            onPress={() => { setNewEventHour(opt.h); setNewEventMinute(opt.m); }}
                                        >
                                            <Text style={[s.eQuickTimeText, isSelected && s.eQuickTimeTextActive]}>
                                                {opt.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={s.eventModalLabel}>Ubicación</Text>
                            <TextInput
                                style={s.eventModalInput}
                                placeholder="Ej: Biblioteca central"
                                placeholderTextColor={Colors.gray}
                                value={newEventLocation}
                                onChangeText={setNewEventLocation}
                            />

                            <Text style={s.eventModalLabel}>Visibilidad</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.groupSelector}>
                                <TouchableOpacity
                                    style={[s.groupChip, !newEventGroupId && s.groupChipActive]}
                                    onPress={() => setNewEventGroupId(null)}
                                >
                                    <Feather name="globe" size={14} color={!newEventGroupId ? '#FFF' : Colors.textSecondary} />
                                    <Text style={[s.groupChipText, !newEventGroupId && s.groupChipTextActive]}>
                                        Universidad
                                    </Text>
                                </TouchableOpacity>
                                {myGroups.map(g => (
                                    <TouchableOpacity
                                        key={g.id}
                                        style={[s.groupChip, newEventGroupId === g.id && s.groupChipActive]}
                                        onPress={() => setNewEventGroupId(g.id)}
                                    >
                                        <Feather name="users" size={14} color={newEventGroupId === g.id ? '#FFF' : Colors.textSecondary} />
                                        <Text style={[s.groupChipText, newEventGroupId === g.id && s.groupChipTextActive]} numberOfLines={1}>
                                            {g.name}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            {!newEventGroupId && (
                                <View style={s.aiHintRow}>
                                    <Feather name="globe" size={13} color="#7C3AED" />
                                    <Text style={[s.aiHintText, { color: '#7C3AED' }]}>
                                        Visible para todos los estudiantes de la universidad
                                    </Text>
                                </View>
                            )}

                            <View style={{ height: 20 }} />
                        </ScrollView>

                        <TouchableOpacity
                            style={[s.eventModalCreateBtn, creatingEvent && { opacity: 0.6 }]}
                            onPress={createEvent}
                            disabled={!newEventName.trim() || !newEventDate || creatingEvent}
                            activeOpacity={0.7}
                        >
                            {creatingEvent ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={s.eventModalCreateBtnText}>Crear evento</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Modal conflictos IA */}
            <Modal visible={showEventConflicts} transparent animationType="fade">
                <View style={s.conflictOverlay}>
                    <View style={s.conflictModal}>
                        <View style={s.conflictHeader}>
                            <View style={s.conflictIconWrap}>
                                <Feather name="alert-triangle" size={24} color="#F59E0B" />
                            </View>
                            <Text style={s.conflictTitle}>Conflictos detectados</Text>
                            <TouchableOpacity onPress={() => setShowEventConflicts(false)}>
                                <Feather name="x" size={22} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={s.conflictBody} showsVerticalScrollIndicator={false}>
                            {eventConflicts?.summary && (
                                <Text style={s.conflictSummary}>{eventConflicts.summary}</Text>
                            )}
                            {eventConflicts?.conflicts?.map((c, i) => (
                                <View key={i} style={[
                                    s.conflictItem,
                                    c.severity === 'high' && s.conflictItemHigh,
                                    c.severity === 'medium' && s.conflictItemMedium,
                                    c.severity === 'low' && s.conflictItemLow,
                                ]}>
                                    <Feather
                                        name={c.severity === 'high' ? 'alert-circle' : 'alert-triangle'}
                                        size={14}
                                        color={c.severity === 'high' ? '#EF4444' : c.severity === 'medium' ? '#F59E0B' : '#6B7280'}
                                    />
                                    <Text style={s.conflictDesc}>{c.description}</Text>
                                </View>
                            ))}
                            {eventConflicts?.recommendations?.map((r, i) => (
                                <View key={`r${i}`} style={s.conflictRecommend}>
                                    <Feather name="cpu" size={13} color={Colors.primary} />
                                    <Text style={s.conflictRecommendText}>{r}</Text>
                                </View>
                            ))}
                        </ScrollView>
                        <TouchableOpacity style={s.conflictCloseBtn} onPress={() => setShowEventConflicts(false)}>
                            <Text style={s.conflictCloseBtnText}>Entendido</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

// ══════════════════════════════════════════
//  SUBCOMPONENTS
// ══════════════════════════════════════════

const EventCard: React.FC<{ event: ZetaEvent; showDate?: boolean; conflict?: ConflictAnalysis }> = ({ event, showDate, conflict }) => (
    <View style={[s.eventCard, conflict && s.eventCardConflict]}>
        <View style={s.eventTimeCol}>
            {showDate && (
                <Text style={s.eventDateSmall}>
                    {new Date(event.event_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                </Text>
            )}
            <Text style={s.eventTime}>{formatTime(event.event_date)}</Text>
        </View>
        <View style={[s.eventAccent, conflict && { backgroundColor: '#F59E0B' }]} />
        <View style={s.eventBody}>
            <Text style={s.eventTitle} numberOfLines={1}>{event.name}</Text>
            {event.group && (
                <View style={s.eventRow}>
                    <Feather name="users" size={12} color={Colors.textSecondary} />
                    <Text style={s.eventSub}>{event.group.name}</Text>
                </View>
            )}
            {event.location && (
                <View style={s.eventRow}>
                    <Feather name="map-pin" size={12} color={Colors.textSecondary} />
                    <Text style={s.eventSub}>{event.location}</Text>
                </View>
            )}
            {conflict && (
                <View style={s.eventConflictBox}>
                    <View style={s.eventConflictHeader}>
                        <Feather name="alert-triangle" size={12} color="#F59E0B" />
                        <Text style={s.eventConflictTitle}>Conflictos IA</Text>
                    </View>
                    {conflict.conflicts.map((c, i) => (
                        <Text key={i} style={[
                            s.eventConflictText,
                            c.severity === 'high' && { color: '#EF4444' },
                        ]} numberOfLines={2}>{c.description}</Text>
                    ))}
                    {conflict.recommendations.length > 0 && (
                        <View style={s.eventRecommendBox}>
                            <Feather name="cpu" size={11} color={Colors.primary} />
                            <Text style={s.eventRecommendText} numberOfLines={2}>
                                {conflict.recommendations[0]}
                            </Text>
                        </View>
                    )}
                </View>
            )}
        </View>
    </View>
);

const TaskCard: React.FC<{ task: Task; onToggle: () => void; onDelete: () => void; aiPending: boolean }> = ({ task, onToggle, onDelete, aiPending }) => {
    const done = task.status === 'completed';
    const pCfg = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
    const overdue = task.due_date && !done && isOverdue(task.due_date);
    const aiProcessing = aiPending && !task.ai_pioritized;

    const pulseAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        if (!aiProcessing) return;
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [aiProcessing]);

    return (
        <View style={[s.taskCard, done && s.taskCardDone]}>
            <TouchableOpacity onPress={onToggle} style={s.taskCheck}>
                <Feather
                    name={done ? 'check-circle' : 'circle'}
                    size={22}
                    color={done ? Colors.success : Colors.gray}
                />
            </TouchableOpacity>
            <View style={s.taskBody}>
                <Text style={[s.taskTitle, done && s.taskTitleDone]} numberOfLines={1}>
                    {task.title}
                </Text>
                <View style={s.taskMeta}>
                    {task.subject && (
                        <View style={s.taskTag}>
                            <Feather name="book" size={11} color={Colors.textSecondary} />
                            <Text style={s.taskTagText}>{task.subject}</Text>
                        </View>
                    )}
                    {aiProcessing ? (
                        <Animated.View style={[s.aiAnalyzing, { opacity: pulseAnim }]}>
                            <Feather name="cpu" size={11} color={Colors.primary} />
                            <Text style={s.aiAnalyzingText}>Analizando con IA...</Text>
                        </Animated.View>
                    ) : (
                        <>
                            <View style={[s.taskPriority, { backgroundColor: pCfg.bg }]}>
                                <Text style={[s.taskPriorityText, { color: pCfg.color }]}>{pCfg.label}</Text>
                            </View>
                            <View style={s.aiBadge}>
                                <Feather name="cpu" size={10} color={Colors.primary} />
                                <Text style={s.aiBadgeText}>IA</Text>
                            </View>
                        </>
                    )}
                    {task.due_date && (
                        <Text style={[s.taskDue, overdue && s.taskDueOverdue]}>
                            {formatDueDate(task.due_date)}
                        </Text>
                    )}
                </View>
                {!aiProcessing && (task.estimated_hours != null && task.estimated_hours > 0) && (
                    <View style={s.taskEstRow}>
                        <Feather name="clock" size={11} color={Colors.textSecondary} />
                        <Text style={s.taskEstText}>
                            ~{task.estimated_hours}h estimadas por IA
                        </Text>
                    </View>
                )}
                {task.group && (
                    <View style={s.taskGroupRow}>
                        <Feather name="users" size={11} color={Colors.textSecondary} />
                        <Text style={s.taskGroupText}>{task.group.name}</Text>
                    </View>
                )}
            </View>
            <TouchableOpacity onPress={onDelete} style={s.taskDelete}>
                <Feather name="trash-2" size={16} color={Colors.gray} />
            </TouchableOpacity>
        </View>
    );
};

// ══════════════════════════════════════════
//  STYLES
// ══════════════════════════════════════════
const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

    // Header
    header: {
        paddingHorizontal: Spacing.screenPadding, paddingTop: 56, paddingBottom: 8,
        backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
    },
    headerTitle: { fontSize: 26, fontWeight: '800', color: Colors.text },
    statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 },
    statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
    statDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.gray },

    // Tabs
    tabs: {
        flexDirection: 'row', paddingHorizontal: Spacing.screenPadding,
        paddingVertical: 10, backgroundColor: Colors.white, gap: 8,
    },
    tab: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingVertical: 9, borderRadius: 12, backgroundColor: Colors.background,
    },
    tabActive: { backgroundColor: Colors.primary },
    tabText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
    tabTextActive: { color: '#FFF' },

    // Calendar
    calendar: { borderBottomWidth: 0, paddingBottom: 4 },
    divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },
    dayHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 12,
    },
    dayHeaderText: { fontSize: 15, fontWeight: '600', color: Colors.text, textTransform: 'capitalize' },
    dayBadge: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
    dayBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
    dayList: { paddingHorizontal: 16, paddingBottom: 80 },
    emptyDay: { alignItems: 'center', paddingVertical: 36 },
    emptyDayText: { fontSize: 14, color: Colors.textSecondary, marginTop: 10 },
    daySectionLabel: {
        fontSize: 13, fontWeight: '700', color: Colors.textSecondary,
        textTransform: 'uppercase', letterSpacing: 0.5,
        marginTop: 12, marginBottom: 8,
    },

    // Day conflict banner (calendar tab)
    dayConflictBanner: {
        backgroundColor: '#F5F3FF', borderRadius: 12, padding: 14,
        marginBottom: 12, borderWidth: 1, borderColor: '#DDD6FE',
    },
    dayConflictBannerHeader: {
        flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10,
    },
    dayConflictBannerTitle: {
        fontSize: 13, fontWeight: '700', color: '#7C3AED',
    },
    dayConflictEntry: {
        marginBottom: 10, paddingBottom: 10,
        borderBottomWidth: 1, borderBottomColor: '#EDE9FE',
    },
    dayConflictEventName: {
        fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 4,
    },
    dayConflictRow: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 3,
    },
    dayConflictText: {
        fontSize: 12, color: '#92400E', lineHeight: 16, flex: 1,
    },
    dayConflictRecommend: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 5,
        marginTop: 4, paddingTop: 4,
    },
    dayConflictRecommendText: {
        fontSize: 12, color: '#7C3AED', fontWeight: '500', flex: 1, lineHeight: 16,
    },

    // Event card
    eventCard: {
        flexDirection: 'row', backgroundColor: Colors.white, borderRadius: 12,
        padding: 14, marginBottom: 10,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
    },
    eventTimeCol: { width: 52, justifyContent: 'center', alignItems: 'center' },
    eventDateSmall: { fontSize: 11, color: Colors.primary, fontWeight: '600', marginBottom: 2 },
    eventTime: { fontSize: 13, fontWeight: '700', color: Colors.primary },
    eventAccent: { width: 3, borderRadius: 2, backgroundColor: Colors.primary, marginHorizontal: 10 },
    eventBody: { flex: 1 },
    eventTitle: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 4 },
    eventRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
    eventSub: { fontSize: 12, color: Colors.textSecondary },
    eventCardConflict: { borderWidth: 1.5, borderColor: '#F59E0B' },
    eventConflictBox: {
        marginTop: 8, backgroundColor: '#FEF3C7', borderRadius: 8, padding: 10,
    },
    eventConflictHeader: {
        flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4,
    },
    eventConflictTitle: { fontSize: 12, fontWeight: '700', color: '#92400E' },
    eventConflictText: { fontSize: 12, color: '#92400E', lineHeight: 16, marginBottom: 2 },
    eventRecommendBox: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 5,
        marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#FDE68A',
    },
    eventRecommendText: { fontSize: 12, color: Colors.primary, fontWeight: '500', flex: 1, lineHeight: 16 },

    // Task card
    taskCard: {
        flexDirection: 'row', alignItems: 'flex-start', backgroundColor: Colors.white,
        borderRadius: 12, padding: 14, marginBottom: 10,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
    },
    taskCardDone: { opacity: 0.6 },
    taskCheck: { marginRight: 12, marginTop: 2 },
    taskBody: { flex: 1 },
    taskTitle: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 6 },
    taskTitleDone: { textDecorationLine: 'line-through', color: Colors.textSecondary },
    taskMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
    taskTag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    taskTagText: { fontSize: 12, color: Colors.textSecondary },
    taskPriority: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    taskPriorityText: { fontSize: 11, fontWeight: '600' },
    taskDue: { fontSize: 12, color: Colors.textSecondary },
    taskDueOverdue: { color: '#EF4444', fontWeight: '600' },
    aiBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: `${Colors.primary}12`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    },
    aiBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.primary },
    aiAnalyzing: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: `${Colors.primary}15`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    },
    aiAnalyzingText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
    taskEstRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    taskEstText: { fontSize: 12, color: Colors.textSecondary },
    taskGroupRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    taskGroupText: { fontSize: 12, color: Colors.textSecondary },
    taskDelete: { padding: 6, marginLeft: 4 },

    // Filters
    filterRow: {
        flexDirection: 'row', paddingHorizontal: Spacing.screenPadding,
        paddingVertical: 10, gap: 8,
    },
    filterChip: {
        paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
        backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border,
    },
    filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    filterChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
    filterChipTextActive: { color: '#FFF' },

    // FAB
    fab: {
        position: 'absolute', bottom: 24, right: 20,
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
        shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
    },

    // Empty states
    emptyState: { alignItems: 'center', paddingVertical: 50 },
    emptyTitle: { fontSize: 17, fontWeight: '600', color: Colors.text, marginTop: 14 },
    emptySub: { fontSize: 14, color: Colors.textSecondary, marginTop: 6, textAlign: 'center' },
    listContent: { paddingHorizontal: Spacing.screenPadding, paddingBottom: 80 },

    // Modal
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
    modalLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, marginTop: 14 },
    modalInput: {
        backgroundColor: Colors.background, borderRadius: 12,
        paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.text,
        borderWidth: 1, borderColor: Colors.border,
    },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    priorityRow: { flexDirection: 'row', gap: 8 },
    priorityChip: {
        flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
        borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white,
    },
    priorityChipText: { fontSize: 13, fontWeight: '600', color: Colors.text },
    modalBtn: {
        backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 14,
        alignItems: 'center', marginTop: 24,
    },
    modalBtnDisabled: { opacity: 0.5 },
    modalBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
    aiHintRow: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        marginTop: 8, paddingHorizontal: 4,
    },
    aiHintText: { fontSize: 12, color: Colors.primary, fontWeight: '500', flex: 1 },

    // ── Event creation modal (matches ChatScreen design) ──
    eventModalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    eventModalContent: {
        backgroundColor: Colors.white,
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        maxHeight: '90%',
    },
    eventModalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border,
    },
    eventModalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
    eventModalBody: { padding: 20 },
    eventModalLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, marginTop: 12 },
    eventModalInput: {
        backgroundColor: Colors.background, borderRadius: 12,
        paddingHorizontal: 14, paddingVertical: 12,
        fontSize: 15, color: Colors.text,
    },
    eventModalCalendar: {
        borderRadius: 12, overflow: 'hidden',
    },
    eventSelectedDateText: {
        fontSize: 13, color: '#7C3AED', fontWeight: '600',
        textAlign: 'center', marginTop: 6, textTransform: 'capitalize',
    },
    eTimePickerRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 4, marginTop: 8,
    },
    eTimePickerCol: { alignItems: 'center' },
    eTimeArrow: { padding: 6 },
    eTimeDisplay: {
        width: 60, height: 48, borderRadius: 12,
        backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center',
    },
    eTimeText: { fontSize: 24, fontWeight: '700', color: Colors.text },
    eTimeSeparator: { fontSize: 24, fontWeight: '700', color: Colors.text, marginHorizontal: 4 },
    eQuickTimeRow: {
        flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 12,
    },
    eQuickTimeChip: {
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
        backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    },
    eQuickTimeChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
    eQuickTimeText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
    eQuickTimeTextActive: { color: '#FFF' },
    eventModalCreateBtn: {
        backgroundColor: '#7C3AED', marginHorizontal: 20, marginBottom: 30, marginTop: 10,
        borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    },
    eventModalCreateBtnText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
    groupSelector: { flexDirection: 'row', marginBottom: 4 },
    groupChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
        backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border, marginRight: 8,
    },
    groupChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
    groupChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, maxWidth: 120 },
    groupChipTextActive: { color: '#FFF' },

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
    conflictSummary: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 14 },
    conflictItem: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 8,
        borderRadius: 10, padding: 12, marginBottom: 8, borderLeftWidth: 3,
    },
    conflictItemHigh: { backgroundColor: '#FEE2E2', borderLeftColor: '#EF4444' },
    conflictItemMedium: { backgroundColor: '#FEF3C7', borderLeftColor: '#F59E0B' },
    conflictItemLow: { backgroundColor: '#F3F4F6', borderLeftColor: '#6B7280' },
    conflictDesc: { fontSize: 14, color: Colors.text, lineHeight: 20, flex: 1 },
    conflictRecommend: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 8,
        backgroundColor: `${Colors.primary}10`, borderRadius: 10, padding: 12, marginBottom: 8,
    },
    conflictRecommendText: { fontSize: 14, color: Colors.primary, lineHeight: 20, flex: 1, fontWeight: '500' },
    conflictCloseBtn: {
        backgroundColor: Colors.primary, marginHorizontal: 20, marginBottom: 20,
        borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    },
    conflictCloseBtnText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
});
