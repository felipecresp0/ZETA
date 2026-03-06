// src/screens/uni/UniScreen.tsx
// Pantalla unificada de gestion universitaria: Calendario + Eventos + Tareas
import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, FlatList,
    RefreshControl, ActivityIndicator, TextInput, Alert,
    Animated, ScrollView, Modal, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Calendar, DateData } from 'react-native-calendars';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { useEvents, MarkedDates } from '../../hooks/useEvents';
import { ZetaEvent } from '../../services/eventsService';
import tasksService, { Task, CreateTaskPayload } from '../../services/tasksService';

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
    const [newTaskPriority, setNewTaskPriority] = useState<string | null>(null);
    const [creatingTask, setCreatingTask] = useState(false);

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
        }, [])
    );

    // ── Calendar marks ──
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

    const dayEvents = useMemo(() => byDate[selectedDate] || [], [byDate, selectedDate]);

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
        if (!newTaskTitle.trim()) return;
        setCreatingTask(true);
        try {
            const payload: CreateTaskPayload = {
                title: newTaskTitle.trim(),
                subject: newTaskSubject.trim() || undefined,
                priority: newTaskPriority || undefined,
            };
            const created = await tasksService.create(payload);
            setTasks(prev => [created, ...prev]);
            setNewTaskTitle('');
            setNewTaskSubject('');
            setNewTaskPriority(null);
            setShowCreateTask(false);
        } catch {
            Alert.alert('Error', 'No se pudo crear la tarea');
        } finally {
            setCreatingTask(false);
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
                markingType="dot"
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
            <FlatList
                data={dayEvents}
                keyExtractor={item => item.id}
                renderItem={({ item }) => <EventCard event={item} />}
                ListHeaderComponent={() => (
                    <View style={s.dayHeader}>
                        <Text style={s.dayHeaderText}>
                            {dayEvents.length > 0 ? formatDateHeader(selectedDate) : 'Sin eventos este dia'}
                        </Text>
                        {dayEvents.length > 0 && (
                            <View style={s.dayBadge}>
                                <Text style={s.dayBadgeText}>{dayEvents.length}</Text>
                            </View>
                        )}
                    </View>
                )}
                ListEmptyComponent={() => (
                    <View style={s.emptyDay}>
                        <Feather name="sun" size={40} color={Colors.grayLight} />
                        <Text style={s.emptyDayText}>Dia libre</Text>
                    </View>
                )}
                contentContainerStyle={s.dayList}
            />
        </View>
    );

    // ══════════════════════════════════════════
    //  TAB: EVENTS LIST
    // ══════════════════════════════════════════
    const renderEvents = () => (
        <FlatList
            data={events}
            keyExtractor={item => item.id}
            renderItem={({ item }) => <EventCard event={item} showDate />}
            ListEmptyComponent={() => (
                <View style={s.emptyState}>
                    <Feather name="calendar" size={48} color={Colors.grayLight} />
                    <Text style={s.emptyTitle}>Sin eventos proximos</Text>
                    <Text style={s.emptySub}>Los eventos de tus grupos apareceran aqui</Text>
                </View>
            )}
            contentContainerStyle={s.listContent}
            refreshControl={
                <RefreshControl refreshing={eventsLoading} onRefresh={refreshEvents} colors={[Colors.primary]} />
            }
        />
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
                            style={[s.modalBtn, (!newTaskTitle.trim() || creatingTask) && s.modalBtnDisabled]}
                            onPress={createTask}
                            disabled={!newTaskTitle.trim() || creatingTask}
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
        </View>
    );
};

// ══════════════════════════════════════════
//  SUBCOMPONENTS
// ══════════════════════════════════════════

const EventCard: React.FC<{ event: ZetaEvent; showDate?: boolean }> = ({ event, showDate }) => (
    <View style={s.eventCard}>
        <View style={s.eventTimeCol}>
            {showDate && (
                <Text style={s.eventDateSmall}>
                    {new Date(event.event_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                </Text>
            )}
            <Text style={s.eventTime}>{formatTime(event.event_date)}</Text>
        </View>
        <View style={s.eventAccent} />
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
        </View>
    </View>
);

const TaskCard: React.FC<{ task: Task; onToggle: () => void; onDelete: () => void }> = ({ task, onToggle, onDelete }) => {
    const done = task.status === 'completed';
    const pCfg = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
    const overdue = task.due_date && !done && isOverdue(task.due_date);

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
                    <View style={[s.taskPriority, { backgroundColor: pCfg.bg }]}>
                        <Text style={[s.taskPriorityText, { color: pCfg.color }]}>{pCfg.label}</Text>
                    </View>
                    {task.ai_pioritized && (
                        <View style={s.aiBadge}>
                            <Feather name="cpu" size={10} color={Colors.primary} />
                            <Text style={s.aiBadgeText}>IA</Text>
                        </View>
                    )}
                    {task.due_date && (
                        <Text style={[s.taskDue, overdue && s.taskDueOverdue]}>
                            {formatDueDate(task.due_date)}
                        </Text>
                    )}
                </View>
                {(task.estimated_hours != null && task.estimated_hours > 0) && (
                    <View style={s.taskEstRow}>
                        <Feather name="clock" size={11} color={Colors.textSecondary} />
                        <Text style={s.taskEstText}>
                            ~{task.estimated_hours}h estimadas
                            {task.ai_pioritized ? ' por IA' : ''}
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
});
