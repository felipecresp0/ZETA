// src/screens/auth/LoginScreen.tsx
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { theme } from '../../theme/index';
import { Input } from '../../components/Input';

const { height } = Dimensions.get('window');

export function LoginScreen() {
    const nav = useNavigation<any>();
    const { login } = useAuth();

    // ── Estado del formulario ──
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

    // ── Validación local antes de llamar al backend ──
    const validate = (): boolean => {
        const e: typeof errors = {};
        if (!email.trim()) {
            e.email = 'Introduce tu email universitario';
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            e.email = 'Email no válido';
        }
        if (!password) {
            e.password = 'Introduce tu contraseña';
        } else if (password.length < 6) {
            e.password = 'Mínimo 6 caracteres';
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    // ── Enviar login al backend ──
    const handleLogin = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            await login(email.trim().toLowerCase(), password);
            // AuthContext redirige automáticamente al Main Stack
        } catch (err: any) {
            // El backend devuelve mensajes descriptivos
            const msg =
                err?.response?.data?.message ||
                err?.message ||
                'Error al iniciar sesión. Revisa tus credenciales.';
            Alert.alert('Error', msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* ── Header ── */}
                <View style={styles.header}>
                    <Text style={styles.logoText}>Z</Text>
                    <Text style={styles.title}>Inicia sesión</Text>
                    <Text style={styles.subtitle}>Accede a tu cuenta Zeta</Text>
                </View>

                {/* ── Formulario ── */}
                <View style={styles.form}>
                    <Input
                        label="Email universitario"
                        placeholder="tu@universidad.es"
                        value={email}
                        onChangeText={(t) => {
                            setEmail(t);
                            if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                        }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                        error={errors.email}
                        icon="mail"
                    />

                    <Input
                        label="Contraseña"
                        placeholder="Tu contraseña"
                        value={password}
                        onChangeText={(t) => {
                            setPassword(t);
                            if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
                        }}
                        secureTextEntry={!showPassword}
                        error={errors.password}
                        icon="lock"
                        rightIcon={showPassword ? 'eye-off' : 'eye'}
                        onRightIconPress={() => setShowPassword(!showPassword)}
                    />

                    <TouchableOpacity
                        style={styles.forgotButton}
                        onPress={() => Alert.alert('Info', 'Funcionalidad próximamente')}
                    >
                        <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
                    </TouchableOpacity>

                    {/* ── Botón Login ── */}
                    <TouchableOpacity
                        style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <Text style={styles.loginButtonText}>Iniciar sesión</Text>
                        )}
                    </TouchableOpacity>

                    {/* ── Separador ── */}
                    <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>o continúa con</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* ── Google (placeholder para futuro OAuth) ── */}
                    <TouchableOpacity
                        style={styles.googleButton}
                        onPress={() => Alert.alert('Info', 'Google Sign-In próximamente')}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.googleIcon}>G</Text>
                        <Text style={styles.googleText}>Google</Text>
                    </TouchableOpacity>
                </View>

                {/* ── Footer ── */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>¿No tienes cuenta? </Text>
                    <TouchableOpacity onPress={() => nav.navigate('Register')}>
                        <Text style={styles.footerLink}>Regístrate</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: theme.spacing.xl,
        paddingTop: height * 0.06,
        paddingBottom: theme.spacing.xl,
    },
    // ── Header ──
    header: {
        alignItems: 'center',
        marginBottom: theme.spacing.xl,
    },
    logoText: {
        fontSize: 56,
        fontWeight: '900',
        color: theme.colors.primary,
        marginBottom: theme.spacing.md,
    },
    title: {
        fontSize: 26,
        fontWeight: '700',
        color: theme.colors.text,
    },
    subtitle: {
        fontSize: 15,
        color: theme.colors.textSecondary,
        marginTop: 4,
    },
    // ── Form ──
    form: {
        gap: 4,
    },
    forgotButton: {
        alignSelf: 'flex-end',
        marginBottom: theme.spacing.md,
        marginTop: -4,
    },
    forgotText: {
        color: theme.colors.primary,
        fontSize: 14,
        fontWeight: '500',
    },
    loginButton: {
        backgroundColor: theme.colors.primary,
        paddingVertical: 16,
        borderRadius: theme.borderRadius.lg,
        alignItems: 'center',
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    loginButtonDisabled: {
        opacity: 0.7,
    },
    loginButtonText: {
        color: '#FFF',
        fontSize: 17,
        fontWeight: '700',
    },
    // ── Divider ──
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: theme.spacing.lg,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: theme.colors.border,
    },
    dividerText: {
        color: theme.colors.textSecondary,
        fontSize: 13,
        marginHorizontal: theme.spacing.sm,
    },
    // ── Google ──
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1.5,
        borderColor: theme.colors.border,
        backgroundColor: '#FFF',
        gap: 10,
    },
    googleIcon: {
        fontSize: 20,
        fontWeight: '700',
        color: '#4285F4',
    },
    googleText: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
    },
    // ── Footer ──
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 'auto',
        paddingTop: theme.spacing.xl,
    },
    footerText: {
        color: theme.colors.textSecondary,
        fontSize: 15,
    },
    footerLink: {
        color: theme.colors.primary,
        fontSize: 15,
        fontWeight: '700',
    },
});