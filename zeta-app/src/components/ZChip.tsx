import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';

interface Props {
    label: string;
    icon?: string;
    selected?: boolean;
    onPress: () => void;
}

export const ZChip: React.FC<Props> = ({ label, icon, selected = false, onPress }) => {
    return (
        <TouchableOpacity
            style={[styles.chip, selected && styles.chipSelected]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            {icon && <Text style={styles.icon}>{icon}</Text>}
            <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: Spacing.radiusFull,
        backgroundColor: Colors.background,
        borderWidth: 1.5,
        borderColor: Colors.border,
        marginRight: 8,
        marginBottom: 8,
    },
    chipSelected: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    icon: { fontSize: 16, marginRight: 6 },
    label: { fontSize: 14, fontWeight: '500', color: Colors.text },
    labelSelected: { color: Colors.white },
});