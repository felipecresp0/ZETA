// src/components/Input.tsx
// Componente reutilizable para todos los inputs de Zeta
import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    TextInputProps,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme/index';

interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
    icon?: keyof typeof Feather.glyphMap;
    rightIcon?: keyof typeof Feather.glyphMap;
    onRightIconPress?: () => void;
}

export function Input({
    label,
    error,
    icon,
    rightIcon,
    onRightIconPress,
    style,
    ...rest
}: InputProps) {
    const [focused, setFocused] = useState(false);

    const borderColor = error
        ? '#EF4444'
        : focused
            ? theme.colors.primary
            : theme.colors.border;

    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label}</Text>}

            <View style={[styles.inputWrapper, { borderColor }]}>
                {icon && (
                    <Feather
                        name={icon}
                        size={18}
                        color={
                            error
                                ? '#EF4444'
                                : focused
                                    ? theme.colors.primary
                                    : theme.colors.textSecondary
                        }
                        style={styles.leftIcon}
                    />
                )}

                <TextInput
                    style={[styles.input, style]}
                    placeholderTextColor={theme.colors.textSecondary + '80'}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    {...rest}
                />

                {rightIcon && (
                    <TouchableOpacity onPress={onRightIconPress} style={styles.rightIcon}>
                        <Feather
                            name={rightIcon}
                            size={18}
                            color={theme.colors.textSecondary}
                        />
                    </TouchableOpacity>
                )}
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: theme.spacing.md,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 6,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderRadius: theme.borderRadius.md,
        backgroundColor: '#FFF',
        paddingHorizontal: 14,
        minHeight: 50,
    },
    leftIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: theme.colors.text,
        paddingVertical: 12,
    },
    rightIcon: {
        marginLeft: 10,
        padding: 4,
    },
    errorText: {
        fontSize: 12,
        color: '#EF4444',
        marginTop: 4,
        marginLeft: 2,
    },
});