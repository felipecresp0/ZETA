// src/screens/auth/SetupProfileScreen.tsx
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    Dimensions,
    FlatList,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';

const { height } = Dimensions.get('window');

// ── Tipos ──
interface University {
    id: string;
    name: string;
    acronym?: string;
    domain_email: string;
}

interface Career {
    id: string;
    name: string;
    area?: string;
}

interface AcademicOffer {
    id: string;
    university_id: string;
    career_id: string;
    modality?: string;
    career: Career;
}

interface Interest {
    id: string;
    name: string;
    category: string;
    icon: string;
}

// ── Iconos por categoría de interés ──
const categoryIcons: Record<string, string> = {
    deporte: '⚽',
    tecnologia: '💻',
    musica: '🎵',
    arte: '🎨',
    ciencia: '🔬',
    lectura: '📚',
    gaming: '🎮',
    cine: '🎬',
    viajes: '✈️',
    cocina: '🍳',
    default: '✨',
};

const YEARS = [
    { value: 1, label: '1º' },
    { value: 2, label: '2º' },
    { value: 3, label: '3º' },
    { value: 4, label: '4º' },
];

const MIN_INTERESTS = 3;
const MAX_INTERESTS = 8;

export function SetupProfileScreen() {
    const { user, refreshUser } = useAuth();

    // ── Datos del servidor ──
    const [universities, setUniversities] = useState<University[]>([]);
    const [offers, setOffers] = useState<AcademicOffer[]>([]);
    const [interests, setInterests] = useState<Interest[]>([]);
    const [groupedInterests, setGroupedInterests] = useState<Record<string, Interest[]>>({});
    const [loadingData, setLoadingData] = useState(true);

    // ── Selecciones del usuario ──
    const [selectedUni, setSelectedUni] = useState<string | null>(null);
    const [selectedOffer, setSelectedOffer] = useState<string | null>(null);
    const [selectedYear, setSelectedYear] = useState<number>(1);
    const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

    // ── UI ──
    const [step, setStep] = useState(1); // 1: uni+carrera+curso, 2: intereses
    const [saving, setSaving] = useState(false);
    const [showUniPicker, setShowUniPicker] = useState(false);
    const [showCareerPicker, setShowCareerPicker] = useState(false);

    // ── Cargar datos iniciales ──
    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            const [uniRes, intRes] = await Promise.all([
                api.get('/universities'),
                api.get('/interests/grouped'),
            ]);
            setUniversities(uniRes.data);
            // El backend devuelve { "Deportes": [...], "Ocio": [...] }
            // Aplanar a array plano para el estado + guardar grouped aparte
            const grouped = intRes.data as Record<string, Interest[]>;
            const flat = Object.values(grouped).flat();
            setInterests(flat);
            setGroupedInterests(grouped);

            // Si el usuario ya tiene universidad asociada por el dominio del email,
            // auto-seleccionarla
            if (user?.email) {
                const domain = user.email.split('@')[1];
                const match = uniRes.data.find(
                    (u: University) => u.domain_email === domain
                );
                if (match) {
                    setSelectedUni(match.id);
                    loadCareers(match.id);
                }
            }
        } catch (err) {
            Alert.alert('Error', 'No se pudieron cargar los datos. Inténtalo de nuevo.');
        } finally {
            setLoadingData(false);
        }
    };

    // ── Cargar carreras (offers) de la universidad seleccionada ──
    const loadCareers = async (uniId: string) => {
        try {
            const { data } = await api.get(`/universities/${uniId}/offers`);
            setOffers(data);
        } catch (err) {
            Alert.alert('Error', 'No se pudieron cargar las carreras.');
        }
    };

    // ── Seleccionar universidad ──
    const handleSelectUni = (uniId: string) => {
        setSelectedUni(uniId);
        setSelectedOffer(null); // Reset carrera
        setShowUniPicker(false);
        loadCareers(uniId);
    };

    // ── Toggle interés ──
    const toggleInterest = (id: string) => {
        setSelectedInterests((prev) => {
            if (prev.includes(id)) return prev.filter((i) => i !== id);
            if (prev.length >= MAX_INTERESTS) {
                Alert.alert('Máximo alcanzado', `Puedes seleccionar hasta ${MAX_INTERESTS} intereses.`);
                return prev;
            }
            return [...prev, id];
        });
    };

    // ── Guardar perfil ──
    const handleSave = async () => {
        if (step === 1) {
            if (!selectedUni || !selectedOffer) {
                Alert.alert('Falta información', 'Selecciona tu universidad y carrera.');
                return;
            }
            setStep(2);
            return;
        }

        // Step 2: guardar todo
        if (selectedInterests.length < MIN_INTERESTS) {
            Alert.alert(
                'Selecciona más intereses',
                `Necesitas al menos ${MIN_INTERESTS} para que el matching funcione bien.`
            );
            return;
        }

        setSaving(true);
        try {
            await api.patch('/users/me', {
                academic_offer_id: selectedOffer,
                year: selectedYear,
                interest_ids: selectedInterests,
                privacy: 'university',
            });
            // Refrescar user en AuthContext para que isOnboardingComplete sea true
            // y el RootNavigator redirija a MainTabs
            await refreshUser();
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Error al guardar el perfil.';
            Alert.alert('Error', msg);
        } finally {
            setSaving(false);
        }
    };

    // ── Helpers ──
    const selectedUniName = universities.find((u) => u.id === selectedUni)?.name;
    const selectedCareerName = offers.find((o) => o.id === selectedOffer)?.career?.name;

    // ── Loading inicial ──
    if (loadingData) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>Cargando datos...</Text>
            </View>
        );
    }

    // ══════════════════════════════════════════
    //  STEP 1: Universidad + Carrera + Curso
    // ══════════════════════════════════════════
    if (step === 1) {
        return (
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.logoText}>Z</Text>
                    <Text style={styles.title}>Configura tu perfil</Text>
                    <Text style={styles.subtitle}>Paso 1 de 2 — Datos académicos</Text>
                </View>

                {/* Step indicator */}
                <View style={styles.stepRow}>
                    <View style={[styles.stepDot, styles.stepActive]} />
                    <View style={styles.stepLine} />
                    <View style={styles.stepDot} />
                </View>

                {/* ── Selector Universidad ── */}
                <Text style={styles.label}>Universidad</Text>
                <TouchableOpacity
                    style={styles.selector}
                    onPress={() => setShowUniPicker(!showUniPicker)}
                >
                    <Feather name="book" size={18} color={Colors.textSecondary} />
                    <Text style={[styles.selectorText, !selectedUni && styles.placeholder]}>
                        {selectedUniName || 'Selecciona tu universidad'}
                    </Text>
                    <Feather
                        name={showUniPicker ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={Colors.textSecondary}
                    />
                </TouchableOpacity>

                {showUniPicker && (
                    <View style={styles.pickerList}>
                        {universities.map((uni) => (
                            <TouchableOpacity
                                key={uni.id}
                                style={[
                                    styles.pickerItem,
                                    selectedUni === uni.id && styles.pickerItemActive,
                                ]}
                                onPress={() => handleSelectUni(uni.id)}
                            >
                                <Text
                                    style={[
                                        styles.pickerItemText,
                                        selectedUni === uni.id && styles.pickerItemTextActive,
                                    ]}
                                >
                                    {uni.name}
                                </Text>
                                {uni.acronym && (
                                    <Text style={styles.pickerItemSub}>{uni.acronym}</Text>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* ── Selector Carrera ── */}
                {selectedUni && (
                    <>
                        <Text style={styles.label}>Carrera</Text>
                        <TouchableOpacity
                            style={styles.selector}
                            onPress={() => setShowCareerPicker(!showCareerPicker)}
                        >
                            <Feather name="briefcase" size={18} color={Colors.textSecondary} />
                            <Text style={[styles.selectorText, !selectedOffer && styles.placeholder]}>
                                {selectedCareerName || 'Selecciona tu carrera'}
                            </Text>
                            <Feather
                                name={showCareerPicker ? 'chevron-up' : 'chevron-down'}
                                size={18}
                                color={Colors.textSecondary}
                            />
                        </TouchableOpacity>

                        {showCareerPicker && (
                            <View style={styles.pickerList}>
                                {offers.length === 0 ? (
                                    <Text style={styles.emptyText}>No hay carreras disponibles</Text>
                                ) : (
                                    offers.map((offer) => (
                                        <TouchableOpacity
                                            key={offer.id}
                                            style={[
                                                styles.pickerItem,
                                                selectedOffer === offer.id && styles.pickerItemActive,
                                            ]}
                                            onPress={() => {
                                                setSelectedOffer(offer.id);
                                                setShowCareerPicker(false);
                                            }}
                                        >
                                            <Text
                                                style={[
                                                    styles.pickerItemText,
                                                    selectedOffer === offer.id && styles.pickerItemTextActive,
                                                ]}
                                            >
                                                {offer.career.name}
                                            </Text>
                                            {offer.modality && (
                                                <Text style={styles.pickerItemSub}>{offer.modality}</Text>
                                            )}
                                        </TouchableOpacity>
                                    ))
                                )}
                            </View>
                        )}
                    </>
                )}

                {/* ── Selector Curso ── */}
                {selectedOffer && (
                    <>
                        <Text style={styles.label}>Curso</Text>
                        <View style={styles.yearRow}>
                            {YEARS.map((y) => (
                                <TouchableOpacity
                                    key={y.value}
                                    style={[
                                        styles.yearChip,
                                        selectedYear === y.value && styles.yearChipActive,
                                    ]}
                                    onPress={() => setSelectedYear(y.value)}
                                >
                                    <Text
                                        style={[
                                            styles.yearChipText,
                                            selectedYear === y.value && styles.yearChipTextActive,
                                        ]}
                                    >
                                        {y.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </>
                )}

                {/* ── Botón Continuar ── */}
                <TouchableOpacity
                    style={[
                        styles.primaryButton,
                        (!selectedUni || !selectedOffer) && styles.buttonDisabled,
                    ]}
                    onPress={handleSave}
                    disabled={!selectedUni || !selectedOffer}
                    activeOpacity={0.8}
                >
                    <Text style={styles.primaryButtonText}>Continuar</Text>
                </TouchableOpacity>
            </ScrollView>
        );
    }

    // ══════════════════════════════════════════
    //  STEP 2: Intereses
    // ══════════════════════════════════════════
    // Agrupar intereses — ya viene del backend
    const grouped = groupedInterests;

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.scrollContent}
        >
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.logoText}>Z</Text>
                <Text style={styles.title}>Tus intereses</Text>
                <Text style={styles.subtitle}>
                    Paso 2 de 2 — Selecciona al menos {MIN_INTERESTS}
                </Text>
            </View>

            {/* Step indicator */}
            <View style={styles.stepRow}>
                <View style={[styles.stepDot, styles.stepDone]} />
                <View style={[styles.stepLine, styles.stepLineDone]} />
                <View style={[styles.stepDot, styles.stepActive]} />
            </View>

            {/* Contador */}
            <View style={styles.counterRow}>
                <Text style={styles.counterText}>
                    {selectedInterests.length} / {MAX_INTERESTS} seleccionados
                </Text>
                {selectedInterests.length >= MIN_INTERESTS && (
                    <View style={styles.checkBadge}>
                        <Feather name="check" size={14} color={Colors.white} />
                    </View>
                )}
            </View>

            {/* ── Intereses agrupados por categoría ── */}
            {Object.entries(grouped).map(([category, items]) => (
                <View key={category} style={styles.categorySection}>
                    <Text style={styles.categoryTitle}>
                        {items[0]?.icon || '✨'}{' '}
                        {category}
                    </Text>
                    <View style={styles.chipsContainer}>
                        {items.map((interest) => {
                            const selected = selectedInterests.includes(interest.id);
                            return (
                                <TouchableOpacity
                                    key={interest.id}
                                    style={[styles.chip, selected && styles.chipActive]}
                                    onPress={() => toggleInterest(interest.id)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                                        {interest.name}
                                    </Text>
                                    {selected && (
                                        <Feather name="check" size={14} color={Colors.white} style={{ marginLeft: 4 }} />
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            ))}

            {/* ── Botones ── */}
            <View style={styles.bottomButtons}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => setStep(1)}
                >
                    <Feather name="arrow-left" size={18} color={Colors.primary} />
                    <Text style={styles.backButtonText}>Atrás</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.primaryButton,
                        styles.finishButton,
                        (selectedInterests.length < MIN_INTERESTS || saving) && styles.buttonDisabled,
                    ]}
                    onPress={handleSave}
                    disabled={selectedInterests.length < MIN_INTERESTS || saving}
                    activeOpacity={0.8}
                >
                    {saving ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.primaryButtonText}>Completar perfil</Text>
                    )}
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

// ══════════════════════════════════════════
//  ESTILOS
// ══════════════════════════════════════════
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    scrollContent: {
        paddingHorizontal: Spacing.screenPadding,
        paddingTop: height * 0.05,
        paddingBottom: 40,
    },
    // ── Loading ──
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.background,
    },
    loadingText: {
        marginTop: 12,
        color: Colors.textSecondary,
        fontSize: 15,
    },
    // ── Header ──
    header: {
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    logoText: {
        fontSize: 48,
        fontWeight: '900',
        color: Colors.primary,
        marginBottom: Spacing.sm,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: Colors.text,
    },
    subtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        marginTop: 4,
    },
    // ── Step indicator ──
    stepRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.lg,
    },
    stepDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: Colors.border,
    },
    stepActive: {
        backgroundColor: Colors.primary,
        width: 14,
        height: 14,
        borderRadius: 7,
    },
    stepDone: {
        backgroundColor: Colors.success,
        width: 14,
        height: 14,
        borderRadius: 7,
    },
    stepLine: {
        width: 40,
        height: 2,
        backgroundColor: Colors.border,
        marginHorizontal: 8,
    },
    stepLineDone: {
        backgroundColor: Colors.success,
    },
    // ── Labels ──
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 6,
        marginTop: Spacing.md,
    },
    // ── Selector dropdown ──
    selector: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: Colors.border,
        borderRadius: Spacing.radiusMd,
        backgroundColor: Colors.white,
        paddingHorizontal: 14,
        paddingVertical: 14,
        gap: 10,
    },
    selectorText: {
        flex: 1,
        fontSize: 16,
        color: Colors.text,
    },
    placeholder: {
        color: Colors.gray,
    },
    // ── Picker list ──
    pickerList: {
        backgroundColor: Colors.white,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: Spacing.radiusMd,
        marginTop: 4,
        maxHeight: 200,
        overflow: 'hidden',
    },
    pickerItem: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: Colors.background,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    pickerItemActive: {
        backgroundColor: `${Colors.primary}15`,
    },
    pickerItemText: {
        fontSize: 15,
        color: Colors.text,
    },
    pickerItemTextActive: {
        color: Colors.primary,
        fontWeight: '600',
    },
    pickerItemSub: {
        fontSize: 13,
        color: Colors.gray,
    },
    emptyText: {
        padding: 16,
        textAlign: 'center',
        color: Colors.gray,
    },
    // ── Year chips ──
    yearRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 4,
    },
    yearChip: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: Spacing.radiusMd,
        borderWidth: 1.5,
        borderColor: Colors.border,
        alignItems: 'center',
        backgroundColor: Colors.white,
    },
    yearChipActive: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary,
    },
    yearChipText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
    },
    yearChipTextActive: {
        color: Colors.white,
    },
    // ── Counter (step 2) ──
    counterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.lg,
        gap: 8,
    },
    counterText: {
        fontSize: 14,
        color: Colors.textSecondary,
        fontWeight: '500',
    },
    checkBadge: {
        backgroundColor: Colors.success,
        width: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // ── Interest categories ──
    categorySection: {
        marginBottom: Spacing.lg,
    },
    categoryTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: Spacing.sm,
    },
    chipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: Spacing.radiusFull,
        borderWidth: 1.5,
        borderColor: Colors.border,
        backgroundColor: Colors.white,
        flexDirection: 'row',
        alignItems: 'center',
    },
    chipActive: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary,
    },
    chipText: {
        fontSize: 14,
        fontWeight: '500',
        color: Colors.text,
    },
    chipTextActive: {
        color: Colors.white,
    },
    // ── Buttons ──
    primaryButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        borderRadius: Spacing.radiusLg,
        alignItems: 'center',
        marginTop: Spacing.xl,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    finishButton: {
        flex: 1,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    primaryButtonText: {
        color: '#FFF',
        fontSize: 17,
        fontWeight: '700',
    },
    bottomButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: Spacing.xl,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        gap: 6,
        borderRadius: Spacing.radiusLg,
        borderWidth: 1.5,
        borderColor: Colors.primary,
    },
    backButtonText: {
        color: Colors.primary,
        fontSize: 15,
        fontWeight: '600',
    },
});