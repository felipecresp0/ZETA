// src/screens/auth/RegisterScreen.tsx
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

export function RegisterScreen() {
    const nav = useNavigation<any>();
    const { register } = useAuth();

    // ── Estado formulario ──
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string | undefined>>({});

    // ── Validación completa ──
    const validate = (): boolean => {
        const e: Record<string, string> = {};

        // Nombre
        if (!name.trim()) {
            e.name = 'Introduce tu nombre';
        } else if (name.trim().length < 2) {
            e.name = 'Mínimo 2 caracteres';
        }

        // Email
        if (!email.trim()) {
            e.email = 'Introduce tu email universitario';
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            e.email = 'Email no válido';
        }
        // Nota: la validación del dominio la hace el backend
        // Si @gmail.com → el backend devuelve 400 con mensaje descriptivo

        // Contraseña
        if (!password) {
            e.password = 'Introduce una contraseña';
        } else if (password.length < 8) {
            e.password = 'Mínimo 8 caracteres';
        }

        // Confirmar
        if (!confirmPassword) {
            e.confirmPassword = 'Confirma tu contraseña';
        } else if (password !== confirmPassword) {
            e.confirmPassword = 'Las contraseñas no coinciden';
        }

        setErrors(e);
        return Object.keys(e).length === 0;
    };

    // ── Enviar registro al backend ──
    const handleRegister = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            await register(name.trim(), email.trim().toLowerCase(), password);
            // AuthContext guarda token y redirige.
            // Si el perfil no está completo (sin carrera/intereses),
            // la navegación detecta onboardingComplete === false
            // y muestra el flujo de Onboarding (Paso 2).
        } catch (err: any) {
            const msg =
                err?.response?.data?.message ||
                err?.message ||
                'Error al registrarse. Inténtalo de nuevo.';
            Alert.alert('Error en el registro', msg);
        } finally {
            setLoading(false);
        }
    };

    // ── Helper para limpiar error de un campo ──
    const clearError = (field: string) => {
        if (errors[field]) {
            setErrors((p) => ({ ...p, [field]: undefined }));
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
                    <Text style={styles.title}>Crea tu cuenta</Text>
                    <Text style={styles.subtitle}>
                        Usa tu email universitario para empezar
                    </Text>
                </View>

                {/* ── Indicador de paso ── */}
                <View style={styles.stepIndicator}>
                    <View style={[styles.stepDot, styles.stepActive]} />
                    <View style={styles.stepLine} />
                    <View style={styles.stepDot} />
                </View>
                <Text style={styles.stepLabel}>Paso 1 de 2 — Datos de acceso</Text>

                {/* ── Formulario ── */}
                <View style={styles.form}>
                    <Input
                        label="Nombre completo"
                        placeholder="Ej: María Pérez"
                        value={name}
                        onChangeText={(t) => { setName(t); clearError('name'); }}
                        autoCapitalize="words"
                        error={errors.name}
                        icon="user"
                    />

                    <Input
                        label="Email universitario"
                        placeholder="tu@universidad.es"
                        value={email}
                        onChangeText={(t) => { setEmail(t); clearError('email'); }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                        error={errors.email}
                        icon="mail"
                    />

                    {/* Aviso informativo sobre dominio */}
                    <View style={styles.infoBox}>
                        <Text style={styles.infoIcon}>ℹ️</Text>
                        <Text style={styles.infoText}>
                            Solo se aceptan correos de universidades registradas.
                            Tu email valida automáticamente tu centro.
                        </Text>
                    </View>

                    <Input
                        label="Contraseña"
                        placeholder="Mínimo 8 caracteres"
                        value={password}
                        onChangeText={(t) => { setPassword(t); clearError('password'); }}
                        secureTextEntry={!showPassword}
                        error={errors.password}
                        icon="lock"
                        rightIcon={showPassword ? 'eye-off' : 'eye'}
                        onRightIconPress={() => setShowPassword(!showPassword)}
                    />

                    {/* Indicador de fuerza de contraseña */}
                    {password.length > 0 && (
                        <View style={styles.strengthContainer}>
                            <View style={styles.strengthBar}>
                                <View
                                    style={[
                                        styles.strengthFill,
                                        {
                                            width:
                                                password.length < 6
                                                    ? '25%'
                                                    : password.length < 10
                                                        ? '50%'
                                                        : password.length < 14
                                                            ? '75%'
                                                            : '100%',
                                            backgroundColor:
                                                password.length < 6
                                                    ? '#EF4444'
                                                    : password.length < 10
                                                        ? '#F59E0B'
                                                        : '#10B981',
                                        },
                                    ]}
                                />
                            </View>
                            <Text style={styles.strengthText}>
                                {password.length < 6
                                    ? 'Débil'
                                    : password.length < 10
                                        ? 'Media'
                                        : 'Fuerte'}
                            </Text>
                        </View>
                    )}

                    <Input
                        label="Confirmar contraseña"
                        placeholder="Repite tu contraseña"
                        value={confirmPassword}
                        onChangeText={(t) => { setConfirmPassword(t); clearError('confirmPassword'); }}
                        secureTextEntry={!showPassword}
                        error={errors.confirmPassword}
                        icon="lock"
                    />

                    {/* ── Botón Registrar ── */}
                    <TouchableOpacity
                        style={[styles.registerButton, loading && styles.buttonDisabled]}
                        onPress={handleRegister}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <Text style={styles.registerButtonText}>Continuar</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* ── Footer ── */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>¿Ya tienes cuenta? </Text>
                    <TouchableOpacity onPress={() => nav.navigate('Login')}>
                        <Text style={styles.footerLink}>Inicia sesión</Text>
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
        paddingTop: height * 0.05,
        paddingBottom: theme.spacing.xl,
    },
    // ── Header ──
    header: {
        alignItems: 'center',
        marginBottom: theme.spacing.lg,
    },
    logoText: {
        fontSize: 48,
        fontWeight: '900',
        color: theme.colors.primary,
        marginBottom: theme.spacing.sm,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: theme.colors.text,
    },
    subtitle: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginTop: 4,
        textAlign: 'center',
    },
    // ── Step indicator ──
    stepIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    stepDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: theme.colors.border,
    },
    stepActive: {
        backgroundColor: theme.colors.primary,
        width: 14,
        height: 14,
        borderRadius: 7,
    },
    stepLine: {
        width: 40,
        height: 2,
        backgroundColor: theme.colors.border,
        marginHorizontal: 8,
    },
    stepLabel: {
        textAlign: 'center',
        fontSize: 13,
        color: theme.colors.textSecondary,
        marginBottom: theme.spacing.lg,
    },
    // ── Form ──
    form: {
        gap: 4,
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: `${theme.colors.primary}10`,
        borderRadius: theme.borderRadius.md,
        padding: 12,
        marginBottom: theme.spacing.sm,
        alignItems: 'flex-start',
        gap: 8,
    },
    infoIcon: {
        fontSize: 14,
        marginTop: 1,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        color: theme.colors.primaryDark,
        lineHeight: 18,
    },
    // ── Password strength ──
    strengthContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: theme.spacing.sm,
        marginTop: -4,
    },
    strengthBar: {
        flex: 1,
        height: 4,
        backgroundColor: theme.colors.border,
        borderRadius: 2,
        overflow: 'hidden',
    },
    strengthFill: {
        height: '100%',
        borderRadius: 2,
    },
    strengthText: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        fontWeight: '500',
        width: 45,
    },
    // ── Botón ──
    registerButton: {
        backgroundColor: theme.colors.primary,
        paddingVertical: 16,
        borderRadius: theme.borderRadius.lg,
        alignItems: 'center',
        marginTop: theme.spacing.md,
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    registerButtonText: {
        color: '#FFF',
        fontSize: 17,
        fontWeight: '700',
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