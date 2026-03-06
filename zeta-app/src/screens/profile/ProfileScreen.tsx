// src/screens/profile/ProfileScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert,
    Image, TextInput, ActivityIndicator, Dimensions, Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import api from '../../services/api';

const { width: SCREEN_W } = Dimensions.get('window');
const PHOTO_SIZE = (SCREEN_W - Spacing.screenPadding * 2 - 24) / 3;
const MAX_PHOTOS = 6;
const MIN_PHOTOS = 2;

// ── Tipos ──
interface Interest { id: string; name: string; category: string; icon: string; }
interface University { id: string; name: string; acronym?: string; }
interface AcademicOffer { id: string; university_id: string; career_id: string; modality?: string; career: { id: string; name: string }; }

const YEARS = [
    { value: 1, label: '1o' },
    { value: 2, label: '2o' },
    { value: 3, label: '3o' },
    { value: 4, label: '4o' },
];

const PRIVACY_OPTIONS = [
    { value: 'public', label: 'Publico', icon: 'globe', desc: 'Cualquiera puede ver tu perfil' },
    { value: 'university', label: 'Universidad', icon: 'book', desc: 'Solo tu universidad' },
    { value: 'career', label: 'Carrera', icon: 'briefcase', desc: 'Solo compañeros de carrera' },
];

export const ProfileScreen: React.FC = () => {
    const { user, logout, refreshUser } = useAuth();
    const nav = useNavigation();

    // ── Estado de edicion ──
    const [editingSection, setEditingSection] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);

    // ── Campos editables ──
    const [name, setName] = useState(user?.name || '');
    const [photos, setPhotos] = useState<string[]>(user?.photos || []);
    const [year, setYear] = useState(user?.year || 1);
    const [privacy, setPrivacy] = useState(user?.privacy || 'public');
    const [selectedInterests, setSelectedInterests] = useState<string[]>(
        user?.interests?.map((i: any) => i.id) || []
    );

    // ── Datos para selectores ──
    const [allInterests, setAllInterests] = useState<Record<string, Interest[]>>({});
    const [universities, setUniversities] = useState<University[]>([]);
    const [offers, setOffers] = useState<AcademicOffer[]>([]);
    const [selectedUni, setSelectedUni] = useState<string | null>(null);
    const [selectedOffer, setSelectedOffer] = useState<string | null>(null);
    const [loadingData, setLoadingData] = useState(false);

    // ── Photo viewer ──
    const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

    // Sync state cuando user cambia
    useFocusEffect(
        useCallback(() => {
            if (user) {
                setName(user.name || '');
                setPhotos(user.photos || []);
                setYear(user.year || 1);
                setPrivacy(user.privacy || 'public');
                setSelectedInterests(user.interests?.map((i: any) => i.id) || []);
                const uniId = (user as any)?.academicOffer?.university_id || null;
                setSelectedUni(uniId);
                setSelectedOffer(user.academic_offer_id || null);
            }
        }, [user])
    );

    const uni = (user as any)?.academicOffer?.university;
    const career = (user as any)?.academicOffer?.career;

    const getInitials = (n: string) => {
        const p = n.split(' ');
        return p.length > 1 ? `${p[0][0]}${p[1][0]}`.toUpperCase() : n.substring(0, 2).toUpperCase();
    };

    // ── Cargar datos para edicion ──
    const loadEditData = async (section: string) => {
        if (section === 'interests' && Object.keys(allInterests).length === 0) {
            setLoadingData(true);
            try {
                const { data } = await api.get('/interests/grouped');
                setAllInterests(data);
            } catch { }
            setLoadingData(false);
        }
        if (section === 'academic') {
            setLoadingData(true);
            try {
                const [uniRes] = await Promise.all([api.get('/universities')]);
                setUniversities(uniRes.data);
                if (selectedUni) {
                    const { data } = await api.get(`/universities/${selectedUni}/offers`);
                    setOffers(data);
                }
            } catch { }
            setLoadingData(false);
        }
    };

    const startEditing = (section: string) => {
        loadEditData(section);
        setEditingSection(section);
    };

    const cancelEditing = () => {
        // Restaurar valores originales
        if (user) {
            setName(user.name || '');
            setYear(user.year || 1);
            setPrivacy(user.privacy || 'public');
            setSelectedInterests(user.interests?.map((i: any) => i.id) || []);
            setSelectedOffer(user.academic_offer_id || null);
        }
        setEditingSection(null);
    };

    // ── Guardar cambios ──
    const saveSection = async (section: string) => {
        setSaving(true);
        try {
            const payload: any = {};
            if (section === 'name') {
                if (name.trim().length < 2) {
                    Alert.alert('Error', 'El nombre debe tener al menos 2 caracteres.');
                    setSaving(false);
                    return;
                }
                payload.name = name.trim();
            }
            if (section === 'academic') {
                payload.academic_offer_id = selectedOffer;
                payload.year = year;
            }
            if (section === 'interests') {
                if (selectedInterests.length < 3) {
                    Alert.alert('Error', 'Selecciona al menos 3 intereses.');
                    setSaving(false);
                    return;
                }
                payload.interest_ids = selectedInterests;
            }
            if (section === 'privacy') {
                payload.privacy = privacy;
            }

            await api.patch('/users/me', payload);
            await refreshUser();
            setEditingSection(null);
        } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.message || 'No se pudo guardar.');
        } finally {
            setSaving(false);
        }
    };

    // ── Fotos ──
    const pickAndUploadPhoto = async () => {
        if (photos.length >= MAX_PHOTOS) {
            Alert.alert('Maximo alcanzado', `Puedes subir hasta ${MAX_PHOTOS} fotos.`);
            return;
        }

        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permisos', 'Necesitamos acceso a tu galeria para subir fotos.');
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
            await refreshUser();
        } catch {
            Alert.alert('Error', 'No se pudo subir la foto.');
        } finally {
            setUploadingPhoto(false);
        }
    };

    const removePhoto = async (url: string) => {
        if (photos.length <= MIN_PHOTOS) {
            Alert.alert('Minimo requerido', `Necesitas al menos ${MIN_PHOTOS} fotos en tu perfil.`);
            return;
        }

        Alert.alert('Eliminar foto', 'Quieres eliminar esta foto?', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Eliminar', style: 'destructive', onPress: async () => {
                    try {
                        const { data } = await api.delete('/uploads/photo', { data: { url } });
                        setPhotos(data.photos);
                        await refreshUser();
                    } catch {
                        Alert.alert('Error', 'No se pudo eliminar la foto.');
                    }
                }
            },
        ]);
    };

    const loadCareers = async (uniId: string) => {
        try {
            const { data } = await api.get(`/universities/${uniId}/offers`);
            setOffers(data);
        } catch { }
    };

    const toggleInterest = (id: string) => {
        setSelectedInterests(prev => {
            if (prev.includes(id)) return prev.filter(i => i !== id);
            if (prev.length >= 8) {
                Alert.alert('Maximo alcanzado', 'Puedes seleccionar hasta 8 intereses.');
                return prev;
            }
            return [...prev, id];
        });
    };

    const handleLogout = () => {
        Alert.alert('Cerrar sesion', 'Seguro que quieres salir?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Salir', style: 'destructive', onPress: () => logout() },
        ]);
    };

    // ── Section header con boton editar/guardar ──
    const SectionHeader = ({ title, section }: { title: string; section: string }) => {
        const isEditing = editingSection === section;
        return (
            <View style={s.sectionHeader}>
                <Text style={s.cardTitle}>{title}</Text>
                {isEditing ? (
                    <View style={s.editActions}>
                        <TouchableOpacity onPress={cancelEditing} style={s.cancelBtn}>
                            <Text style={s.cancelText}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => saveSection(section)}
                            style={s.saveBtn}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <Text style={s.saveText}>Guardar</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                ) : (
                    <TouchableOpacity onPress={() => startEditing(section)} style={s.editBtn}>
                        <Feather name="edit-2" size={16} color={Colors.primary} />
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <ScrollView style={s.container} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
                    <Feather name="arrow-left" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={s.headerTitle}>Mi perfil</Text>
                <View style={{ width: 32 }} />
            </View>

            {/* ══════════════════════════════════════ */}
            {/*  FOTOS                                */}
            {/* ══════════════════════════════════════ */}
            <View style={s.card}>
                <View style={s.sectionHeader}>
                    <Text style={s.cardTitle}>Mis fotos</Text>
                    <Text style={s.photoCounter}>{photos.length}/{MAX_PHOTOS}</Text>
                </View>

                <View style={s.photosGrid}>
                    {photos.map((url, i) => (
                        <TouchableOpacity
                            key={i}
                            style={s.photoSlot}
                            onPress={() => setViewingPhoto(url)}
                            activeOpacity={0.85}
                        >
                            <Image source={{ uri: url }} style={s.photoImage} />
                            <TouchableOpacity
                                style={s.photoRemove}
                                onPress={() => removePhoto(url)}
                            >
                                <Feather name="x" size={14} color="#FFF" />
                            </TouchableOpacity>
                            {i === 0 && (
                                <View style={s.mainPhotoBadge}>
                                    <Text style={s.mainPhotoText}>Principal</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    ))}

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
                                    <Feather name="plus" size={24} color={Colors.primary} />
                                    <Text style={s.addPhotoText}>Anadir</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* ══════════════════════════════════════ */}
            {/*  DATOS PERSONALES                     */}
            {/* ══════════════════════════════════════ */}
            <View style={s.card}>
                <SectionHeader title="Datos personales" section="name" />

                {editingSection === 'name' ? (
                    <>
                        <View style={s.editField}>
                            <Text style={s.editLabel}>Nombre</Text>
                            <TextInput
                                style={s.textInput}
                                value={name}
                                onChangeText={setName}
                                maxLength={50}
                                placeholder="Tu nombre"
                                placeholderTextColor={Colors.gray}
                            />
                        </View>
                        <InfoRow icon="mail" label="Email" value={user?.email || '-'} />
                    </>
                ) : (
                    <>
                        <InfoRow icon="user" label="Nombre" value={user?.name || '-'} />
                        <InfoRow icon="mail" label="Email" value={user?.email || '-'} />
                    </>
                )}
            </View>

            {/* ══════════════════════════════════════ */}
            {/*  INFO ACADEMICA                       */}
            {/* ══════════════════════════════════════ */}
            <View style={s.card}>
                <SectionHeader title="Informacion academica" section="academic" />

                {editingSection === 'academic' ? (
                    loadingData ? (
                        <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
                    ) : (
                        <View>
                            {/* Universidad (solo lectura) */}
                            <InfoRow icon="book" label="Universidad" value={uni?.name || 'Sin asignar'} />

                            {/* Carrera */}
                            {selectedUni && offers.length > 0 && (
                                <>
                                    <Text style={[s.editLabel, { marginTop: 16 }]}>Carrera</Text>
                                    {offers.map(o => (
                                        <TouchableOpacity
                                            key={o.id}
                                            style={[s.optionRow, selectedOffer === o.id && s.optionRowActive]}
                                            onPress={() => setSelectedOffer(o.id)}
                                        >
                                            <View style={[s.radio, selectedOffer === o.id && s.radioActive]}>
                                                {selectedOffer === o.id && <View style={s.radioInner} />}
                                            </View>
                                            <Text style={[s.optionText, selectedOffer === o.id && s.optionTextActive]}>
                                                {o.career.name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </>
                            )}

                            {/* Curso */}
                            <Text style={[s.editLabel, { marginTop: 16 }]}>Curso</Text>
                            <View style={s.yearRow}>
                                {YEARS.map(y => (
                                    <TouchableOpacity
                                        key={y.value}
                                        style={[s.yearChip, year === y.value && s.yearChipActive]}
                                        onPress={() => setYear(y.value)}
                                    >
                                        <Text style={[s.yearChipText, year === y.value && s.yearChipTextActive]}>
                                            {y.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )
                ) : (
                    <>
                        <InfoRow icon="book" label="Universidad" value={uni?.name || 'Sin asignar'} />
                        <InfoRow icon="briefcase" label="Carrera" value={career?.name || 'Sin asignar'} />
                        <InfoRow icon="hash" label="Curso" value={user?.year ? `${user.year}o` : '-'} />
                    </>
                )}
            </View>

            {/* ══════════════════════════════════════ */}
            {/*  INTERESES                            */}
            {/* ══════════════════════════════════════ */}
            <View style={s.card}>
                <SectionHeader title="Intereses" section="interests" />

                {editingSection === 'interests' ? (
                    loadingData ? (
                        <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
                    ) : (
                        <View>
                            <Text style={s.interestCounter}>
                                {selectedInterests.length}/8 seleccionados (min. 3)
                            </Text>
                            {Object.entries(allInterests).map(([category, items]) => (
                                <View key={category} style={s.categorySection}>
                                    <Text style={s.categoryTitle}>
                                        {items[0]?.icon || ''} {category}
                                    </Text>
                                    <View style={s.chipsWrap}>
                                        {items.map(interest => {
                                            const selected = selectedInterests.includes(interest.id);
                                            return (
                                                <TouchableOpacity
                                                    key={interest.id}
                                                    style={[s.interestChip, selected && s.interestChipActive]}
                                                    onPress={() => toggleInterest(interest.id)}
                                                >
                                                    <Text style={[s.interestChipText, selected && s.interestChipTextActive]}>
                                                        {interest.name}
                                                    </Text>
                                                    {selected && <Feather name="check" size={13} color="#FFF" style={{ marginLeft: 4 }} />}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            ))}
                        </View>
                    )
                ) : (
                    <View style={s.chipsWrap}>
                        {user?.interests && user.interests.length > 0 ? (
                            user.interests.map((i: any) => (
                                <View key={i.id} style={s.chip}>
                                    <Text style={s.chipText}>{i.icon} {i.name}</Text>
                                </View>
                            ))
                        ) : (
                            <Text style={s.emptyText}>Sin intereses seleccionados</Text>
                        )}
                    </View>
                )}
            </View>

            {/* ══════════════════════════════════════ */}
            {/*  PRIVACIDAD                           */}
            {/* ══════════════════════════════════════ */}
            <View style={s.card}>
                <SectionHeader title="Privacidad" section="privacy" />

                {editingSection === 'privacy' ? (
                    PRIVACY_OPTIONS.map(opt => (
                        <TouchableOpacity
                            key={opt.value}
                            style={[s.optionRow, privacy === opt.value && s.optionRowActive]}
                            onPress={() => setPrivacy(opt.value)}
                        >
                            <View style={[s.radio, privacy === opt.value && s.radioActive]}>
                                {privacy === opt.value && <View style={s.radioInner} />}
                            </View>
                            <Feather
                                name={opt.icon as any}
                                size={18}
                                color={privacy === opt.value ? Colors.primary : Colors.gray}
                                style={{ marginRight: 10 }}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={[s.optionText, privacy === opt.value && s.optionTextActive]}>
                                    {opt.label}
                                </Text>
                                <Text style={s.optionDesc}>{opt.desc}</Text>
                            </View>
                        </TouchableOpacity>
                    ))
                ) : (
                    <InfoRow
                        icon="eye"
                        label="Visibilidad"
                        value={PRIVACY_OPTIONS.find(o => o.value === user?.privacy)?.label || 'Publico'}
                    />
                )}
            </View>

            {/* ══════════════════════════════════════ */}
            {/*  LOGOUT                               */}
            {/* ══════════════════════════════════════ */}
            <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
                <Feather name="log-out" size={20} color="#FFF" />
                <Text style={s.logoutText}>Cerrar sesion</Text>
            </TouchableOpacity>

            {/* ══════════════════════════════════════ */}
            {/*  PHOTO VIEWER MODAL                   */}
            {/* ══════════════════════════════════════ */}
            <Modal visible={!!viewingPhoto} transparent animationType="fade">
                <View style={s.modalOverlay}>
                    <TouchableOpacity style={s.modalClose} onPress={() => setViewingPhoto(null)}>
                        <Feather name="x" size={28} color="#FFF" />
                    </TouchableOpacity>
                    {viewingPhoto && (
                        <Image
                            source={{ uri: viewingPhoto }}
                            style={s.modalImage}
                            resizeMode="contain"
                        />
                    )}
                </View>
            </Modal>
        </ScrollView>
    );
};

// ── Componente fila de info ──
const InfoRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
    <View style={s.infoRow}>
        <Feather name={icon as any} size={18} color={Colors.primary} />
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue} numberOfLines={1}>{value}</Text>
    </View>
);

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    content: { paddingBottom: 40 },

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.screenPadding, paddingTop: 56, paddingBottom: 12,
        backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },

    // Card
    card: {
        backgroundColor: Colors.white, marginHorizontal: Spacing.screenPadding,
        marginTop: 16, borderRadius: 16, padding: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    },
    cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },

    // Section header
    sectionHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 14,
    },
    editBtn: {
        width: 34, height: 34, borderRadius: 17,
        backgroundColor: `${Colors.primary}12`, justifyContent: 'center', alignItems: 'center',
    },
    editActions: { flexDirection: 'row', gap: 8 },
    cancelBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8 },
    cancelText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
    saveBtn: {
        paddingVertical: 6, paddingHorizontal: 16, borderRadius: 8,
        backgroundColor: Colors.primary,
    },
    saveText: { fontSize: 14, color: '#FFF', fontWeight: '600' },

    // Photos
    photoCounter: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
    photosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    photoSlot: {
        width: PHOTO_SIZE, height: PHOTO_SIZE * 1.3, borderRadius: 14, overflow: 'hidden',
    },
    photoSlotEmpty: {
        borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed',
        justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background,
    },
    photoImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    photoRemove: {
        position: 'absolute', top: 6, right: 6,
        width: 26, height: 26, borderRadius: 13,
        backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center',
    },
    mainPhotoBadge: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: Colors.primary, paddingVertical: 3, alignItems: 'center',
    },
    mainPhotoText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
    addPhotoText: { fontSize: 12, color: Colors.primary, fontWeight: '600', marginTop: 4 },

    // Info rows
    infoRow: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 11,
        borderBottomWidth: 1, borderBottomColor: Colors.background, gap: 10,
    },
    infoLabel: { fontSize: 14, color: Colors.textSecondary, width: 90 },
    infoValue: { flex: 1, fontSize: 14, fontWeight: '500', color: Colors.text, textAlign: 'right' },

    // Edit fields
    editField: { marginBottom: 8 },
    editLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
    textInput: {
        backgroundColor: Colors.background, borderRadius: 12,
        paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.text,
        borderWidth: 1, borderColor: Colors.border,
    },

    // Horizontal scroll selectors
    horizontalScroll: { marginBottom: 4 },
    selectChip: {
        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
        borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white,
        marginRight: 8,
    },
    selectChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
    selectChipText: { fontSize: 14, fontWeight: '500', color: Colors.text },
    selectChipTextActive: { color: '#FFF' },

    // Option rows (radio)
    optionRow: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12,
        borderRadius: 12, marginBottom: 6, backgroundColor: Colors.background,
    },
    optionRowActive: { backgroundColor: `${Colors.primary}10` },
    optionText: { fontSize: 14, fontWeight: '500', color: Colors.text },
    optionTextActive: { color: Colors.primary, fontWeight: '600' },
    optionDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
    radio: {
        width: 20, height: 20, borderRadius: 10, borderWidth: 2,
        borderColor: Colors.border, justifyContent: 'center', alignItems: 'center',
        marginRight: 10,
    },
    radioActive: { borderColor: Colors.primary },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },

    // Year
    yearRow: { flexDirection: 'row', gap: 10 },
    yearChip: {
        flex: 1, paddingVertical: 10, borderRadius: 10,
        borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center',
        backgroundColor: Colors.white,
    },
    yearChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
    yearChipText: { fontSize: 15, fontWeight: '600', color: Colors.text },
    yearChipTextActive: { color: '#FFF' },

    // Interests
    interestCounter: {
        fontSize: 13, color: Colors.textSecondary, fontWeight: '500', marginBottom: 12,
    },
    categorySection: { marginBottom: 16 },
    categoryTitle: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 8 },
    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    interestChip: {
        paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
        borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white,
        flexDirection: 'row', alignItems: 'center',
    },
    interestChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
    interestChipText: { fontSize: 13, fontWeight: '500', color: Colors.text },
    interestChipTextActive: { color: '#FFF' },
    chip: {
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
        backgroundColor: `${Colors.primary}12`,
    },
    chipText: { fontSize: 13, color: Colors.primary, fontWeight: '500' },
    emptyText: { fontSize: 14, color: Colors.textSecondary },

    // Logout
    logoutBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#EF4444', marginHorizontal: Spacing.screenPadding,
        marginTop: 24, paddingVertical: 16, borderRadius: 14, gap: 8,
    },
    logoutText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

    // Photo viewer modal
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.92)',
        justifyContent: 'center', alignItems: 'center',
    },
    modalClose: {
        position: 'absolute', top: 56, right: 20, zIndex: 10,
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center', alignItems: 'center',
    },
    modalImage: { width: SCREEN_W - 40, height: SCREEN_W * 1.3 },
});
