import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';

interface Props {
    children: React.ReactNode;
    style?: ViewStyle;
}

export const ZCard: React.FC<Props> = ({ children, style }) => (
    <View style={[styles.card, style]}>{children}</View>
);

const styles = StyleSheet.create({
    card: {
        backgroundColor: Colors.card,
        borderRadius: Spacing.radiusLg,
        padding: Spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
});