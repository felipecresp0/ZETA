import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';

interface Props extends TextInputProps {
    label?: string;
    error?: string;
    icon?: React.ReactNode;
}

export const ZInput: React.FC<Props> = ({ label, error, icon, style, ...props }) => {
    const [focused, setFocused] = useState(false);

    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label}</Text>}
            <View style={[
                styles.inputWrap,
                focused && styles.inputFocused,
                error && styles.inputError,
            ]}>
                {icon && <View style={styles.icon}>{icon}</View>}
                <TextInput
                    style={[styles.input, style]}
                    placeholderTextColor={Colors.gray}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    {...props}
                />
            </View>
            {error && <Text style={styles.error}>{error}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { marginBottom: Spacing.md },
    label: { ...Typography.bodySmall, fontWeight: '600', color: Colors.text, marginBottom: 6 },
    inputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.white,
        borderWidth: 1.5,
        borderColor: Colors.border,
        borderRadius: Spacing.radiusMd,
        paddingHorizontal: 14,
    },
    inputFocused: { borderColor: Colors.primary },
    inputError: { borderColor: Colors.error },
    icon: { marginRight: 10 },
    input: {
        flex: 1,
        paddingVertical: 14,
        fontSize: 16,
        color: Colors.text,
    },
    error: { ...Typography.caption, color: Colors.error, marginTop: 4 },
});