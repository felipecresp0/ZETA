// src/screens/auth/SetupProfileScreen.tsx
import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    Alert, ActivityIndicator, Dimensions, Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';

const { height, width } = Dimensions.get('window');
const PHOTO_SIZE = (width - Spacing.screenPadding * 2 - 24) / 3;

// ── Tipos ──
interface University { id: string; name: string; acronym?: string; domain_email: string; }
interface Career { id: string; name: string; area?: string; }
interface AcademicOffer { id: string; university_id: string; career_id: string; modality?: string; career: Career; }
interface Interest { id: string; name: string; category: string; icon: string; }

const YEARS = [
    { value: 1, label: '1º' },
    { value: 2, label: '2º' },
    { value: 3, label: '3º' },
    { value: 4, label: '4º' },
];

const MIN_INTERESTS = 3;
const MAX_INTERESTS = 8;
const MIN_PHOTOS = 2;
const MAX_PHOTOS = 6;
const TOTAL_STEPS = 3;

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
    const [photos, setPhotos] = useState<string[]>([]);

    // ── UI ──
    const [step, setStep] = useState(1);
    const [saving, setSaving] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [showUniPicker, setShowUniPicker] = useState(false);
    const [showCareerPicker, setShowCareerPicker] = useState(false);

    useEffect(() => { loadInitialData(); }, []);

    const loadInitialData = async () => {
        try {
            const [uniRes, intRes] = await Promise.all([
                api.get('/universities'),
                api.get('/interests/grouped'),
            ]);
            setUniversities(uniRes.data);
            const grouped = intRes.data as Record<string, Interest[]>;
            setInterests(Object.values(grouped).flat());
            setGroupedInterests(grouped);

            if (user?.email) {
                const domain = user.email.split('@')[1];
                const match = uniRes.data.find((u: University) => u.domain_email === domain);
                if (match) {
                    setSelectedUni(match.id);
                    loadCareers(match.id);
                }
            }
        } catch {
            Alert.alert('Error', 'No se pudieron cargar los datos.');
        } finally {
            setLoadingData(false);
        }
    };

    const loadCareers = async (uniId: string) => {
        try {
            const { data } = await api.get(`/universities/${uniId}/offers`);
            setOffers(data);
        } catch {
            Alert.alert('Error', 'No se pudieron cargar las carreras.');
        }
    };

    const handleSelectUni = (uniId: string) => {
        setSelectedUni(uniId);
        setSelectedOffer(null);
        setShowUniPicker(false);
        loadCareers(uniId);
    };

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

    // ── Subir foto ──
    const pickAndUploadPhoto = async () => {
        if (photos.length >= MAX_PHOTOS) {
            Alert.alert('Máximo alcanzado', `Puedes subir hasta ${MAX_PHOTOS} fotos.`);
            return;
        }

        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permisos', 'Necesitamos acceso a tu galería para subir fotos.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [3, 4],
            quality: 0.8,
        });

        if (result.canceled) return;

        setUploadingPhoto(true);
        try {
            const uri = result.assets[0].uri;
            const filename = uri.split('/').pop() || 'photo.jpg';
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : 'image/jpeg';

            const formData = new FormData();
            formData.append('file', { uri, name: filename, type } as any);

            const { data } = await api.post('/uploads/photo', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setPhotos(data.photos);
        } catch (err) {
            Alert.alert('Error', 'No se pudo subir la foto. Inténtalo de nuevo.');
        } finally {
            setUploadingPhoto(false);
        }
    };

    // ── Eliminar foto ──
    const removePhoto = async (url: string) => {
        try {
            const { data } = await api.delete('/uploads/photo', { data: { url } });
            setPhotos(data.photos);
        } catch {
            Alert.alert('Error', 'No se pudo eliminar la foto.');
        }
    };

    // ── Navegación entre pasos ──
    const handleNext = () => {
        if (step === 1) {
            if (!selectedUni || !selectedOffer) {
                Alert.alert('Falta información', 'Selecciona tu universidad y carrera.');
                return;
            }
            setStep(2);
        } else if (step === 2) {
            if (selectedInterests.length < MIN_INTERESTS) {
                Alert.alert('Selecciona más intereses', `Necesitas al menos ${MIN_INTERESTS} para que el matching funcione bien.`);
                return;
            }
            setStep(3);
        } else if (step === 3) {
            handleSave();
        }
    };

    const handleSave = async () => {
        if (photos.length < MIN_PHOTOS) {
            Alert.alert('Sube más fotos', `Necesitas al menos ${MIN_PHOTOS} fotos para tu perfil.`);
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
            await refreshUser();
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Error al guardar el perfil.';
            Alert.alert('Error', msg);
        } finally {
            setSaving(false);
        }
    };

    const selectedUniName = universities.find((u) => u.id === selectedUni)?.name;
    const selectedCareerName = offers.find((o) => o.id === selectedOffer)?.career?.name;

    if (loadingData) {
        return (
            <View style={s.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={s.loadingText}>Cargando datos...</Text>
            </View>
        );
    }

    // ── Step indicator component ──
    const StepIndicator = () => (
        <View style={s.stepRow}>
            {[1, 2, 3].map((n, i) => (
                <React.Fragment key={n}>
                    {i > 0 && <View style={[s.stepLine, step > n - 1 && s.stepLineDone]} />}
                    <View style={[
                        s.stepDot,
                        step === n && s.stepActive,
                        step > n && s.stepDone,
                    ]}>
                        {step > n && <Feather name="check" size={10} color="#FFF" />}
                    </View>
                </React.Fragment>
            ))}
        </View>
    );

    // ══════════════════════════════════════════
    //  STEP 1: Universidad + Carrera + Curso
    // ══════════════════════════════════════════
    if (step === 1) {
        return (
            <ScrollView style={s.container} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
                <View style={s.header}>
                    <Text style={s.logoText}>Z</Text>
                    <Text style={s.title}>Configura tu perfil</Text>
                    <Text style={s.subtitle}>Paso 1 de {TOTAL_STEPS} — Datos académicos</Text>
                </View>

                <StepIndicator />

                <Text style={s.label}>Universidad</Text>
                <TouchableOpacity style={s.selector} onPress={() => setShowUniPicker(!showUniPicker)}>
                    <Feather name="book" size={18} color={Colors.textSecondary} />
                    <Text style={[s.selectorText, !selectedUni && s.placeholder]}>
                        {selectedUniName || 'Selecciona tu universidad'}
                    </Text>
                    <Feather name={showUniPicker ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textSecondary} />
                </TouchableOpacity>

                {showUniPicker && (
                    <View style={s.pickerList}>
                        {universities.map((uni) => (
                            <TouchableOpacity
                                key={uni.id}
                                style={[s.pickerItem, selectedUni === uni.id && s.pickerItemActive]}
                                onPress={() => handleSelectUni(uni.id)}
                            >
                                <Text style={[s.pickerItemText, selectedUni === uni.id && s.pickerItemTextActive]}>
                                    {uni.name}
                                </Text>
                                {uni.acronym && <Text style={s.pickerItemSub}>{uni.acronym}</Text>}
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {selectedUni && (
                    <>
                        <Text style={s.label}>Carrera</Text>
                        <TouchableOpacity style={s.selector} onPress={() => setShowCareerPicker(!showCareerPicker)}>
                            <Feather name="briefcase" size={18} color={Colors.textSecondary} />
                            <Text style={[s.selectorText, !selectedOffer && s.placeholder]}>
                                {selectedCareerName || 'Selecciona tu carrera'}
                            </Text>
                            <Feather name={showCareerPicker ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textSecondary} />
                        </TouchableOpacity>

                        {showCareerPicker && (
                            <View style={s.pickerList}>
                                {offers.length === 0 ? (
                                    <Text style={s.emptyText}>No hay carreras disponibles</Text>
                                ) : (
                                    offers.map((offer) => (
                                        <TouchableOpacity
                                            key={offer.id}
                                            style={[s.pickerItem, selectedOffer === offer.id && s.pickerItemActive]}
                                            onPress={() => { setSelectedOffer(offer.id); setShowCareerPicker(false); }}
                                        >
                                            <Text style={[s.pickerItemText, selectedOffer === offer.id && s.pickerItemTextActive]}>
                                                {offer.career.name}
                                            </Text>
                                            {offer.modality && <Text style={s.pickerItemSub}>{offer.modality}</Text>}
                                        </TouchableOpacity>
                                    ))
                                )}
                            </View>
                        )}
                    </>
                )}

                {selectedOffer && (
                    <>
                        <Text style={s.label}>Curso</Text>
                        <View style={s.yearRow}>
                            {YEARS.map((y) => (
                                <TouchableOpacity
                                    key={y.value}
                                    style={[s.yearChip, selectedYear === y.value && s.yearChipActive]}
                                    onPress={() => setSelectedYear(y.value)}
                                >
                                    <Text style={[s.yearChipText, selectedYear === y.value && s.yearChipTextActive]}>
                                        {y.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </>
                )}

                <TouchableOpacity
                    style={[s.primaryButton, (!selectedUni || !selectedOffer) && s.buttonDisabled]}
                    onPress={handleNext}
                    disabled={!selectedUni || !selectedOffer}
                >
                    <Text style={s.primaryButtonText}>Continuar</Text>
                </TouchableOpacity>
            </ScrollView>
        );
    }

    // ══════════════════════════════════════════
    //  STEP 2: Intereses
    // ══════════════════════════════════════════
    if (step === 2) {
        return (
            <ScrollView style={s.container} contentContainerStyle={s.scrollContent}>
                <View style={s.header}>
                    <Text style={s.logoText}>Z</Text>
                    <Text style={s.title}>Tus intereses</Text>
                    <Text style={s.subtitle}>Paso 2 de {TOTAL_STEPS} — Selecciona al menos {MIN_INTERESTS}</Text>
                </View>

                <StepIndicator />

                <View style={s.counterRow}>
                    <Text style={s.counterText}>{selectedInterests.length} / {MAX_INTERESTS} seleccionados</Text>
                    {selectedInterests.length >= MIN_INTERESTS && (
                        <View style={s.checkBadge}><Feather name="check" size={14} color="#FFF" /></View>
                    )}
                </View>

                {Object.entries(groupedInterests).map(([category, items]) => (
                    <View key={category} style={s.categorySection}>
                        <Text style={s.categoryTitle}>{items[0]?.icon || '✨'} {category}</Text>
                        <View style={s.chipsContainer}>
                            {items.map((interest) => {
                                const selected = selectedInterests.includes(interest.id);
                                return (
                                    <TouchableOpacity
                                        key={interest.id}
                                        style={[s.chip, selected && s.chipActive]}
                                        onPress={() => toggleInterest(interest.id)}
                                    >
                                        <Text style={[s.chipText, selected && s.chipTextActive]}>{interest.name}</Text>
                                        {selected && <Feather name="check" size={14} color="#FFF" style={{ marginLeft: 4 }} />}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                ))}

                <View style={s.bottomButtons}>
                    <TouchableOpacity style={s.backButton} onPress={() => setStep(1)}>
                        <Feather name="arrow-left" size={18} color={Colors.primary} />
                        <Text style={s.backButtonText}>Atrás</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[s.primaryButton, s.finishButton, selectedInterests.length < MIN_INTERESTS && s.buttonDisabled]}
                        onPress={handleNext}
                        disabled={selectedInterests.length < MIN_INTERESTS}
                    >
                        <Text style={s.primaryButtonText}>Continuar</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        );
    }

    // ══════════════════════════════════════════
    //  STEP 3: Fotos
    // ══════════════════════════════════════════
    return (
        <ScrollView style={s.container} contentContainerStyle={s.scrollContent}>
            <View style={s.header}>
                <Text style={s.logoText}>Z</Text>
                <Text style={s.title}>Tus fotos</Text>
                <Text style={s.subtitle}>Paso 3 de {TOTAL_STEPS} — Sube al menos {MIN_PHOTOS} fotos</Text>
            </View>

            <StepIndicator />

            <Text style={s.photoDescription}>
                Tus fotos se mostrarán en tu perfil de matching. Los compañeros podrán ver cómo eres antes de conectar contigo.
            </Text>

            {/* Grid de fotos */}
            <View style={s.photosGrid}>
                {/* Fotos subidas */}
                {photos.map((url, i) => (
                    <View key={i} style={s.photoSlot}>
                        <Image source={{ uri: url }} style={s.photoImage} />
                        <TouchableOpacity style={s.photoRemove} onPress={() => removePhoto(url)}>
                            <Feather name="x" size={14} color="#FFF" />
                        </TouchableOpacity>
                        {i === 0 && (
                            <View style={s.mainPhotoBadge}>
                                <Text style={s.mainPhotoText}>Principal</Text>
                            </View>
                        )}
                    </View>
                ))}

                {/* Slots vacíos para añadir */}
                {photos.length < MAX_PHOTOS && (
                    <TouchableOpacity
                        style={[s.photoSlot, s.photoSlotEmpty]}
                        onPress={pickAndUploadPhoto}
                        disabled={uploadingPhoto}
                    >
                        {uploadingPhoto ? (
                            <ActivityIndicator color={Colors.primary} />
                        ) : (
                            <>
                                <Feather name="plus" size={28} color={Colors.primary} />
                                <Text style={s.photoSlotText}>Añadir</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}

                {/* Slots vacíos restantes (para visualizar el mínimo) */}
                {Array.from({ length: Math.max(0, MIN_PHOTOS - photos.length - 1) }).map((_, i) => (
                    <View key={`empty-${i}`} style={[s.photoSlot, s.photoSlotEmpty, s.photoSlotDisabled]}>
                        <Feather name="image" size={24} color={Colors.border} />
                    </View>
                ))}
            </View>

            {/* Contador */}
            <View style={s.counterRow}>
                <Text style={[s.counterText, photos.length < MIN_PHOTOS && { color: Colors.error }]}>
                    {photos.length} / {MIN_PHOTOS} mínimo
                </Text>
                {photos.length >= MIN_PHOTOS && (
                    <View style={s.checkBadge}><Feather name="check" size={14} color="#FFF" /></View>
                )}
            </View>

            {/* Tips */}
            <View style={s.tipsBox}>
                <Feather name="info" size={16} color={Colors.primary} />
                <View style={s.tipsContent}>
                    <Text style={s.tipText}>• Usa fotos donde se vea bien tu cara</Text>
                    <Text style={s.tipText}>• Evita fotos de grupo o con gafas de sol</Text>
                    <Text style={s.tipText}>• La primera foto será tu foto principal</Text>
                </View>
            </View>

            {/* Botones */}
            <View style={s.bottomButtons}>
                <TouchableOpacity style={s.backButton} onPress={() => setStep(2)}>
                    <Feather name="arrow-left" size={18} color={Colors.primary} />
                    <Text style={s.backButtonText}>Atrás</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[s.primaryButton, s.finishButton, (photos.length < MIN_PHOTOS || saving) && s.buttonDisabled]}
                    onPress={handleNext}
                    disabled={photos.length < MIN_PHOTOS || saving}
                >
                    {saving ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={s.primaryButtonText}>Completar perfil</Text>
                    )}
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

// ══════════════════════════════════════════
const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    scrollContent: { paddingHorizontal: Spacing.screenPadding, paddingTop: height * 0.05, paddingBottom: 40 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
    loadingText: { marginTop: 12, color: Colors.textSecondary, fontSize: 15 },

    // Header
    header: { alignItems: 'center', marginBottom: Spacing.lg },
    logoText: { fontSize: 48, fontWeight: '900', color: Colors.primary, marginBottom: Spacing.sm },
    title: { fontSize: 24, fontWeight: '700', color: Colors.text },
    subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },

    // Steps
    stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
    stepDot: {
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: Colors.border, justifyContent: 'center', alignItems: 'center',
    },
    stepActive: { backgroundColor: Colors.primary },
    stepDone: { backgroundColor: Colors.success },
    stepLine: { width: 32, height: 2, backgroundColor: Colors.border, marginHorizontal: 6 },
    stepLineDone: { backgroundColor: Colors.success },

    // Labels
    label: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: Spacing.md },

    // Selector
    selector: {
        flexDirection: 'row', alignItems: 'center', borderWidth: 1.5,
        borderColor: Colors.border, borderRadius: Spacing.radiusMd,
        backgroundColor: Colors.white, paddingHorizontal: 14, paddingVertical: 14, gap: 10,
    },
    selectorText: { flex: 1, fontSize: 16, color: Colors.text },
    placeholder: { color: Colors.gray },

    // Picker
    pickerList: {
        backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
        borderRadius: Spacing.radiusMd, marginTop: 4, maxHeight: 200, overflow: 'hidden',
    },
    pickerItem: {
        paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
        borderBottomColor: Colors.background, flexDirection: 'row',
        justifyContent: 'space-between', alignItems: 'center',
    },
    pickerItemActive: { backgroundColor: `${Colors.primary}15` },
    pickerItemText: { fontSize: 15, color: Colors.text },
    pickerItemTextActive: { color: Colors.primary, fontWeight: '600' },
    pickerItemSub: { fontSize: 13, color: Colors.gray },
    emptyText: { padding: 16, textAlign: 'center', color: Colors.gray },

    // Year
    yearRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    yearChip: {
        flex: 1, paddingVertical: 12, borderRadius: Spacing.radiusMd,
        borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.white,
    },
    yearChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
    yearChipText: { fontSize: 16, fontWeight: '600', color: Colors.text },
    yearChipTextActive: { color: '#FFF' },

    // Counter
    counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg, gap: 8 },
    counterText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
    checkBadge: { backgroundColor: Colors.success, width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },

    // Interests
    categorySection: { marginBottom: Spacing.lg },
    categoryTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm },
    chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: Spacing.radiusFull,
        borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white,
        flexDirection: 'row', alignItems: 'center',
    },
    chipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
    chipText: { fontSize: 14, fontWeight: '500', color: Colors.text },
    chipTextActive: { color: '#FFF' },

    // Photos (Step 3)
    photoDescription: {
        fontSize: 14, color: Colors.textSecondary, textAlign: 'center',
        lineHeight: 20, marginBottom: Spacing.lg, paddingHorizontal: 10,
    },
    photosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: Spacing.lg },
    photoSlot: {
        width: PHOTO_SIZE, height: PHOTO_SIZE * 1.3, borderRadius: 16, overflow: 'hidden',
    },
    photoSlotEmpty: {
        borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed',
        justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.white,
    },
    photoSlotDisabled: { opacity: 0.4 },
    photoSlotText: { fontSize: 12, color: Colors.primary, fontWeight: '600', marginTop: 4 },
    photoImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    photoRemove: {
        position: 'absolute', top: 6, right: 6,
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center',
    },
    mainPhotoBadge: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: Colors.primary, paddingVertical: 3, alignItems: 'center',
    },
    mainPhotoText: { fontSize: 11, fontWeight: '700', color: '#FFF' },

    // Tips
    tipsBox: {
        flexDirection: 'row', gap: 10, backgroundColor: `${Colors.primary}10`,
        borderRadius: 12, padding: 14, marginBottom: Spacing.lg,
    },
    tipsContent: { flex: 1, gap: 4 },
    tipText: { fontSize: 13, color: Colors.primary, lineHeight: 18 },

    // Buttons
    primaryButton: {
        backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: Spacing.radiusLg,
        alignItems: 'center', marginTop: Spacing.xl,
        shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
    },
    finishButton: { flex: 1 },
    buttonDisabled: { opacity: 0.5 },
    primaryButtonText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
    bottomButtons: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: Spacing.xl },
    backButton: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16,
        gap: 6, borderRadius: Spacing.radiusLg, borderWidth: 1.5, borderColor: Colors.primary,
    },
    backButtonText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
});