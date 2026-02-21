// src/theme/index.ts
// Unifica colors, spacing y typography en un solo objeto "theme"
// para que import { theme } from '../theme' funcione en toda la app

import { Colors } from './colors';
import { Spacing } from './spacing';
import { Typography } from './typography';

export const theme = {
    colors: {
        primary: Colors.primary,
        primaryDark: Colors.dark,
        secondary: Colors.secondary,
        background: Colors.background,
        card: Colors.card,
        text: Colors.text,
        textSecondary: Colors.textSecondary,
        border: Colors.border,
        gray: Colors.gray,
        grayLight: Colors.grayLight,
        white: Colors.white,
        success: Colors.success,
        warning: Colors.warning,
        error: Colors.error,
        info: Colors.info,
        overlay: Colors.overlay,
        // Chat
        bubbleMine: Colors.bubbleMine,
        bubbleOther: Colors.bubbleOther,
        bubbleTextMine: Colors.bubbleTextMine,
        bubbleTextOther: Colors.bubbleTextOther,
    },
    spacing: {
        xs: Spacing.xs,
        sm: Spacing.sm,
        md: Spacing.md,
        lg: Spacing.lg,
        xl: Spacing.xl,
        xxl: Spacing.xxl,
        screenPadding: Spacing.screenPadding,
    },
    borderRadius: {
        sm: Spacing.radiusSm,
        md: Spacing.radiusMd,
        lg: Spacing.radiusLg,
        full: Spacing.radiusFull,
    },
    typography: Typography,
};

// Re-exportar originales por si alguien los usa directamente
export { Colors } from './colors';
export { Spacing } from './spacing';
export { Typography } from './typography';