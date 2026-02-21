import { StyleSheet } from 'react-native';
import { Colors } from './colors';

export const Typography = StyleSheet.create({
    h1: {
        fontSize: 28,
        fontWeight: '700',
        color: Colors.text,
        letterSpacing: -0.5,
    },
    h2: {
        fontSize: 22,
        fontWeight: '700',
        color: Colors.text,
    },
    h3: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.text,
    },
    body: {
        fontSize: 16,
        fontWeight: '400',
        color: Colors.text,
        lineHeight: 24,
    },
    bodySmall: {
        fontSize: 14,
        fontWeight: '400',
        color: Colors.textSecondary,
        lineHeight: 20,
    },
    caption: {
        fontSize: 12,
        fontWeight: '400',
        color: Colors.gray,
    },
    button: {
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    chip: {
        fontSize: 14,
        fontWeight: '500',
    },
});