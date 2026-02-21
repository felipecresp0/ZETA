import React from 'react';
import {
    TouchableOpacity, Text, StyleSheet,
    ActivityIndicator, ViewStyle, TextStyle
} from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';

interface Props {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    disabled?: boolean;
    style?: ViewStyle;
}

export const ZButton: React.FC<Props> = ({
    title, onPress, variant = 'primary', size = 'md',
    loading = false, disabled = false, style,
}) => {
    const btnStyles: ViewStyle[] = [styles.base, styles[size]];
    const txtStyles: TextStyle[] = [Typography.button];

    if (variant === 'primary') {
        btnStyles.push(styles.primary);
        txtStyles.push({ color: Colors.white });
    } else if (variant === 'secondary') {
        btnStyles.push(styles.secondary);
        txtStyles.push({ color: Colors.white });
    } else if (variant === 'outline') {
        btnStyles.push(styles.outline);
        txtStyles.push({ color: Colors.primary });
    } else if (variant === 'ghost') {
        btnStyles.push(styles.ghost);
        txtStyles.push({ color: Colors.primary });
    }

    if (disabled || loading) {
        btnStyles.push({ opacity: 0.6 });
    }

    return (
        <TouchableOpacity
            style={[...btnStyles, style]}
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.7}
        >
            {loading ? (
                <ActivityIndicator color={variant === 'outline' ? Colors.primary : Colors.white} />
            ) : (
                <Text style={txtStyles}>{title}</Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    base: {
        borderRadius: Spacing.radiusMd,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sm: { paddingVertical: 8, paddingHorizontal: 16 },
    md: { paddingVertical: 14, paddingHorizontal: 24 },
    lg: { paddingVertical: 18, paddingHorizontal: 32 },
    primary: { backgroundColor: Colors.primary },
    secondary: { backgroundColor: Colors.secondary },
    outline: { backgroundColor: 'transparent', borderWidth: 2, borderColor: Colors.primary },
    ghost: { backgroundColor: 'transparent' },
});