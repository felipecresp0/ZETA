// src/screens/profile/ProfileScreen.tsx
import React from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';

export const ProfileScreen: React.FC = () => {
    const { user, logout } = useAuth();
    const nav = useNavigation();

    const getInitials = (name: string) => {
        const p = name.split(' ');
        return p.length > 1 ? `${p[0][0]}${p[1][0]}`.toUpperCase() : name.substring(0, 2).toUpperCase();
    };

    const handleLogout = () => {
        Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Salir', style: 'destructive', onPress: () => logout() },
        ]);
    };

    const uni = (user as any)?.academicOffer?.university?.name;
    const career = (user as any)?.academicOffer?.career?.name;

    return (
        <ScrollView style={s.container} contentContainerStyle={s.content}>
            {/* Header con botón atrás */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
                    <Feather name="arrow-left" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={s.headerTitle}>Mi perfil</Text>
                <View style={{ width: 32 }} />
            </View>

            {/* Avatar + nombre */}
            <View style={s.avatarSection}>
                <View style={s.avatar}>
                    <Text style={s.avatarText}>{getInitials(user?.name || 'U')}</Text>
                </View>
                <Text style={s.name}>{user?.name}</Text>
                <Text style={s.email}>{user?.email}</Text>
            </View>

            {/* Info académica */}
            <View style={s.card}>
                <Text style={s.cardTitle}>Información académica</Text>
                <InfoRow icon="book" label="Universidad" value={uni || 'Sin asignar'} />
                <InfoRow icon="briefcase" label="Carrera" value={career || 'Sin asignar'} />
                <InfoRow icon="hash" label="Curso" value={user?.year ? `${user.year}º` : '-'} />
                <InfoRow icon="eye" label="Privacidad" value={user?.privacy || 'public'} />
            </View>

            {/* Intereses */}
            {user?.interests && user.interests.length > 0 && (
                <View style={s.card}>
                    <Text style={s.cardTitle}>Intereses</Text>
                    <View style={s.chips}>
                        {user.interests.map((i: any) => (
                            <View key={i.id} style={s.chip}>
                                <Text style={s.chipText}>{i.icon} {i.name}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}

            {/* Logout */}
            <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
                <Feather name="log-out" size={20} color="#FFF" />
                <Text style={s.logoutText}>Cerrar sesión</Text>
            </TouchableOpacity>
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
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.screenPadding, paddingTop: 56, paddingBottom: 12,
        backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
    avatarSection: { alignItems: 'center', paddingVertical: 28, backgroundColor: Colors.white },
    avatar: {
        width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary,
        justifyContent: 'center', alignItems: 'center', marginBottom: 12,
    },
    avatarText: { color: '#FFF', fontSize: 28, fontWeight: '700' },
    name: { fontSize: 22, fontWeight: '700', color: Colors.text },
    email: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
    card: {
        backgroundColor: Colors.white, marginHorizontal: Spacing.screenPadding,
        marginTop: 16, borderRadius: 12, padding: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12 },
    infoRow: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
        borderBottomWidth: 1, borderBottomColor: Colors.background, gap: 10,
    },
    infoLabel: { fontSize: 14, color: Colors.textSecondary, width: 90 },
    infoValue: { flex: 1, fontSize: 14, fontWeight: '500', color: Colors.text, textAlign: 'right' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
        backgroundColor: `${Colors.primary}15`,
    },
    chipText: { fontSize: 13, color: Colors.primary, fontWeight: '500' },
    logoutBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#EF4444', marginHorizontal: Spacing.screenPadding,
        marginTop: 24, paddingVertical: 16, borderRadius: 12, gap: 8,
    },
    logoutText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});