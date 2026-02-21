// src/screens/Groups/CreateGroupScreen.tsx
// Formulario para crear un nuevo grupo
import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { createGroup, CreateGroupDto } from '../../services/groupService';
import { Colors } from '../../theme/index';

// Opciones de tipo de grupo
const GROUP_TYPES = [
    { value: 'general', label: 'General', icon: 'people-outline', desc: 'Grupo de temática libre' },
    { value: 'carrera', label: 'Carrera', icon: 'school-outline', desc: 'Para compañeros de carrera' },
    { value: 'interes', label: 'Interés', icon: 'heart-outline', desc: 'Basado en un hobby o interés' },
    { value: 'estudio', label: 'Estudio', icon: 'book-outline', desc: 'Grupo de estudio' },
] as const;

const PRIVACY_OPTIONS = [
    { value: 'public', label: 'Público', icon: 'globe-outline', desc: 'Cualquiera puede unirse' },
    { value: 'university', label: 'Universidad', icon: 'business-outline', desc: 'Solo tu universidad' },
    { value: 'private', label: 'Privado', icon: 'lock-closed-outline', desc: 'Solo por invitación' },
] as const;

export default function CreateGroupScreen() {
    const navigation = useNavigation<any>();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState<CreateGroupDto['type']>('general');
    const [privacy, setPrivacy] = useState<CreateGroupDto['privacy']>('public');
    const [submitting, setSubmitting] = useState(false);

    const canSubmit = name.trim().length >= 3 && !submitting;

    const handleCreate = async () => {
        if (!canSubmit) return;

        setSubmitting(true);
        try {
            const group = await createGroup({
                name: name.trim(),
                description: description.trim() || undefined,
                type,
                privacy,
            });

            Alert.alert('Grupo creado', `"${group.name}" está listo.`, [
                {
                    text: 'Ver grupo',
                    onPress: () => {
                        navigation.replace('GroupDetail', { groupId: group.id });
                    },
                },
            ]);
        } catch (e: any) {
            Alert.alert('Error', e.message || 'No se pudo crear el grupo');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={s.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#212121" />
                </TouchableOpacity>
                <Text style={s.headerTitle}>Crear Grupo</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                contentContainerStyle={s.scroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Nombre */}
                <Text style={s.label}>Nombre del grupo *</Text>
                <TextInput
                    style={s.input}
                    placeholder="Ej: DAM 1º San Valero"
                    placeholderTextColor="#999"
                    value={name}
                    onChangeText={setName}
                    maxLength={60}
                />
                <Text style={s.hint}>{name.length}/60 — mínimo 3 caracteres</Text>

                {/* Descripción */}
                <Text style={s.label}>Descripción</Text>
                <TextInput
                    style={[s.input, s.textArea]}
                    placeholder="¿De qué trata este grupo?"
                    placeholderTextColor="#999"
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={4}
                    maxLength={250}
                    textAlignVertical="top"
                />
                <Text style={s.hint}>{description.length}/250</Text>

                {/* Tipo */}
                <Text style={s.label}>Tipo de grupo</Text>
                <View style={s.optionsGrid}>
                    {GROUP_TYPES.map(opt => (
                        <TouchableOpacity
                            key={opt.value}
                            style={[s.optionCard, type === opt.value && s.optionActive]}
                            onPress={() => setType(opt.value)}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={opt.icon as any}
                                size={24}
                                color={type === opt.value ? Colors.primary : '#999'}
                            />
                            <Text style={[s.optionLabel, type === opt.value && s.optionLabelActive]}>
                                {opt.label}
                            </Text>
                            <Text style={s.optionDesc}>{opt.desc}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Privacidad */}
                <Text style={s.label}>Privacidad</Text>
                {PRIVACY_OPTIONS.map(opt => (
                    <TouchableOpacity
                        key={opt.value}
                        style={[s.privacyRow, privacy === opt.value && s.privacyActive]}
                        onPress={() => setPrivacy(opt.value)}
                        activeOpacity={0.7}
                    >
                        <View style={[
                            s.radioOuter,
                            privacy === opt.value && { borderColor: Colors.primary }
                        ]}>
                            {privacy === opt.value && <View style={s.radioInner} />}
                        </View>
                        <Ionicons
                            name={opt.icon as any}
                            size={20}
                            color={privacy === opt.value ? Colors.primary : '#999'}
                            style={{ marginRight: 10 }}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={[s.privacyLabel, privacy === opt.value && { color: Colors.primary }]}>
                                {opt.label}
                            </Text>
                            <Text style={s.privacyDesc}>{opt.desc}</Text>
                        </View>
                    </TouchableOpacity>
                ))}

                {/* Botón crear */}
                <TouchableOpacity
                    style={[s.submitBtn, !canSubmit && s.submitDisabled]}
                    onPress={handleCreate}
                    disabled={!canSubmit}
                    activeOpacity={0.8}
                >
                    {submitting ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <>
                            <Ionicons name="add-circle-outline" size={20} color="#FFF" />
                            <Text style={s.submitText}>Crear Grupo</Text>
                        </>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FA' },

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 60, paddingBottom: 14, paddingHorizontal: 16,
        backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#212121' },

    scroll: { padding: 20, paddingBottom: 100 },

    // Form fields
    label: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 20, marginBottom: 8 },
    input: {
        backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
        fontSize: 15, color: '#212121', borderWidth: 1, borderColor: '#E0E0E0',
    },
    textArea: { height: 100, paddingTop: 14 },
    hint: { fontSize: 12, color: '#999', marginTop: 4, textAlign: 'right' },

    // Type grid
    optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    optionCard: {
        width: '48%', backgroundColor: '#FFF', borderRadius: 12, padding: 14,
        borderWidth: 1.5, borderColor: '#E0E0E0', alignItems: 'center', gap: 4,
    },
    optionActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '08' },
    optionLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
    optionLabelActive: { color: Colors.primary },
    optionDesc: { fontSize: 11, color: '#999', textAlign: 'center' },

    // Privacy
    privacyRow: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
        borderRadius: 12, padding: 14, marginBottom: 8,
        borderWidth: 1.5, borderColor: '#E0E0E0',
    },
    privacyActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '08' },
    radioOuter: {
        width: 20, height: 20, borderRadius: 10, borderWidth: 2,
        borderColor: '#CCC', justifyContent: 'center', alignItems: 'center', marginRight: 10,
    },
    radioInner: {
        width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary,
    },
    privacyLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
    privacyDesc: { fontSize: 12, color: '#999' },

    // Submit
    submitBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16,
        marginTop: 32, gap: 8,
    },
    submitDisabled: { opacity: 0.5 },
    submitText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});