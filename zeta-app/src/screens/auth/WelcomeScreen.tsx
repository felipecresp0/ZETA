// src/screens/auth/WelcomeScreen.tsx
import React, { useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    FlatList,
    Animated,
    TouchableOpacity,
    Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../../theme/index';

const { width, height } = Dimensions.get('window');

// ── Slides del onboarding visual ──
const slides = [
    {
        id: '1',
        icon: '🎓',
        title: 'Bienvenido a Zeta',
        subtitle: 'Conecta estudios y amigos\ndesde el día 1',
    },
    {
        id: '2',
        icon: '🤝',
        title: 'Matching Inteligente',
        subtitle: 'Encuentra compañeros de tu carrera\ncon intereses similares antes de llegar',
    },
    {
        id: '3',
        icon: '📅',
        title: 'Calendario sin choques',
        subtitle: 'Eventos, clases y quedadas\norganizados con IA',
    },
    {
        id: '4',
        icon: '✅',
        title: 'Tareas inteligentes',
        subtitle: 'Prioridades automáticas y\ntiempos estimados por IA',
    },
];

export function WelcomeScreen() {
    const nav = useNavigation<any>();
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollX = useRef(new Animated.Value(0)).current;
    const flatListRef = useRef<FlatList>(null);

    // ── Renderizar cada slide ──
    const renderSlide = ({ item }: { item: typeof slides[0] }) => (
        <View style={[styles.slide, { width }]}>
            <Text style={styles.slideIcon}>{item.icon}</Text>
            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
        </View>
    );

    // ── Indicadores de paginación ──
    const renderDots = () => (
        <View style={styles.dotsContainer}>
            {slides.map((_, i) => {
                const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
                const dotWidth = scrollX.interpolate({
                    inputRange,
                    outputRange: [8, 24, 8],
                    extrapolate: 'clamp',
                });
                const opacity = scrollX.interpolate({
                    inputRange,
                    outputRange: [0.3, 1, 0.3],
                    extrapolate: 'clamp',
                });
                return (
                    <Animated.View
                        key={i}
                        style={[styles.dot, { width: dotWidth, opacity }]}
                    />
                );
            })}
        </View>
    );

    // ── Avanzar slide o ir a Login ──
    const handleNext = () => {
        if (currentIndex < slides.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
        } else {
            nav.navigate('Login');
        }
    };

    return (
        <View style={styles.container}>
            {/* Logo Zeta arriba */}
            <View style={styles.logoContainer}>
                <Text style={styles.logoText}>Z</Text>
                <Text style={styles.logoLabel}>ZETA</Text>
            </View>

            {/* Carrusel de slides */}
            <FlatList
                ref={flatListRef}
                data={slides}
                renderItem={renderSlide}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: false }
                )}
                onMomentumScrollEnd={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
                    setCurrentIndex(idx);
                }}
            />

            {/* Dots */}
            {renderDots()}

            {/* Botones inferiores */}
            <View style={styles.bottomContainer}>
                <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleNext}
                    activeOpacity={0.8}
                >
                    <Text style={styles.primaryButtonText}>
                        {currentIndex === slides.length - 1 ? 'Empezar' : 'Siguiente'}
                    </Text>
                </TouchableOpacity>

                {currentIndex < slides.length - 1 && (
                    <TouchableOpacity
                        onPress={() => nav.navigate('Login')}
                        style={styles.skipButton}
                    >
                        <Text style={styles.skipText}>Saltar</Text>
                    </TouchableOpacity>
                )}

                {currentIndex === slides.length - 1 && (
                    <TouchableOpacity
                        onPress={() => nav.navigate('Register')}
                        style={styles.secondaryButton}
                    >
                        <Text style={styles.secondaryButtonText}>
                            ¿No tienes cuenta? Regístrate
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    // ── Logo ──
    logoContainer: {
        alignItems: 'center',
        paddingTop: height * 0.08,
        paddingBottom: 10,
    },
    logoText: {
        fontSize: 64,
        fontWeight: '900',
        color: theme.colors.primary,
        letterSpacing: -2,
    },
    logoLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: theme.colors.primaryDark,
        letterSpacing: 6,
        marginTop: -8,
    },
    // ── Slides ──
    slide: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.xl,
    },
    slideIcon: {
        fontSize: 72,
        marginBottom: theme.spacing.lg,
    },
    slideTitle: {
        fontSize: 26,
        fontWeight: '700',
        color: theme.colors.text,
        textAlign: 'center',
        marginBottom: theme.spacing.sm,
    },
    slideSubtitle: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
    },
    // ── Dots ──
    dotsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: theme.spacing.xl,
    },
    dot: {
        height: 8,
        borderRadius: 4,
        backgroundColor: theme.colors.primary,
        marginHorizontal: 4,
    },
    // ── Botones ──
    bottomContainer: {
        paddingHorizontal: theme.spacing.xl,
        paddingBottom: height * 0.06,
        gap: 12,
    },
    primaryButton: {
        backgroundColor: theme.colors.primary,
        paddingVertical: 16,
        borderRadius: theme.borderRadius.lg,
        alignItems: 'center',
        // Sombra sutil
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '700',
    },
    skipButton: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    skipText: {
        color: theme.colors.textSecondary,
        fontSize: 15,
    },
    secondaryButton: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    secondaryButtonText: {
        color: theme.colors.primary,
        fontSize: 15,
        fontWeight: '600',
    },
});