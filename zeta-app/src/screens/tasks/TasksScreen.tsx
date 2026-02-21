import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';

export const TasksScreen: React.FC = () => (
    <View style={s.container}>
        <Text style={s.emoji}>✅</Text>
        <Text style={s.title}>Tareas</Text>
        <Text style={s.sub}>Gestor inteligente — próximamente</Text>
    </View>
);

const s = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.background,
        padding: 20,
    },
    emoji: { fontSize: 48, marginBottom: 16 },
    title: { fontSize: 24, fontWeight: '700', color: Colors.text, marginBottom: 8 },
    sub: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
});