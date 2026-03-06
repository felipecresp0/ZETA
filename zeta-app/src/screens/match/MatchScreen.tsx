import React, { useState, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
    Dimensions, Alert, Animated, PanResponder, Image, ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import api from '../../services/api';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_W * 0.25;
const CARD_W = SCREEN_W * 0.88;
const CARD_H = SCREEN_H * 0.62;

// ── Tipos ──
interface MatchedUser {
    id: string;
    name: string;
    photos: string[];
    year: number;
    academicOffer?: {
        university?: { name: string; acronym?: string };
        career?: { name: string };
    };
    interests?: { id: string; name: string; icon?: string }[];
}

interface MatchItem {
    id: string;
    matchedUser: MatchedUser;
    affinity_score: number;
    common_interests: string[];
    reason: string | null;
    status: string;
}

type Tab = 'suggestions' | 'connections';

export const MatchScreen: React.FC = () => {
    const nav = useNavigation<any>();
    const [matches, setMatches] = useState<MatchItem[]>([]);
    const [connections, setConnections] = useState<MatchItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>('suggestions');
    const [currentIdx, setCurrentIdx] = useState(0);
    const [actionLoading, setActionLoading] = useState(false);
    const [photoIdx, setPhotoIdx] = useState(0);

    // Refs para acceder al estado actual desde el PanResponder
    const matchesRef = useRef<MatchItem[]>([]);
    const currentIdxRef = useRef(0);

    // ── Animación swipe ──
    const position = useRef(new Animated.ValueXY()).current;
    const rotate = position.x.interpolate({
        inputRange: [-SCREEN_W / 2, 0, SCREEN_W / 2],
        outputRange: ['-12deg', '0deg', '12deg'],
        extrapolate: 'clamp',
    });
    const likeOpacity = position.x.interpolate({
        inputRange: [0, SCREEN_W / 4],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });
    const nopeOpacity = position.x.interpolate({
        inputRange: [-SCREEN_W / 4, 0],
        outputRange: [1, 0],
        extrapolate: 'clamp',
    });
    const nextScale = position.x.interpolate({
        inputRange: [-SCREEN_W / 2, 0, SCREEN_W / 2],
        outputRange: [1, 0.92, 1],
        extrapolate: 'clamp',
    });

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderMove: (_, gesture) => {
                position.setValue({ x: gesture.dx, y: gesture.dy * 0.5 });
            },
            onPanResponderRelease: (_, gesture) => {
                if (gesture.dx > SWIPE_THRESHOLD) {
                    swipeOut('right');
                } else if (gesture.dx < -SWIPE_THRESHOLD) {
                    swipeOut('left');
                } else {
                    Animated.spring(position, {
                        toValue: { x: 0, y: 0 },
                        useNativeDriver: true,
                        friction: 5,
                    }).start();
                }
            },
        }),
    ).current;

    // Mantener refs sincronizados con el estado
    matchesRef.current = matches;
    currentIdxRef.current = currentIdx;

    const swipeOut = (dir: 'left' | 'right') => {
        const x = dir === 'right' ? SCREEN_W + 100 : -SCREEN_W - 100;
        Animated.timing(position, {
            toValue: { x, y: 0 },
            duration: 300,
            useNativeDriver: true,
        }).start(() => {
            const match = matchesRef.current[currentIdxRef.current];
            if (dir === 'right') {
                handleAccept(match);
            } else {
                handleReject(match);
            }
            position.setValue({ x: 0, y: 0 });
            setPhotoIdx(0);
            setCurrentIdx(prev => prev + 1);
        });
    };

    // ── Data loading ──
    const loadData = useCallback(async () => {
        try {
            const [matchRes, connRes] = await Promise.all([
                api.get('/matches/me'),
                api.get('/matches/connections'),
            ]);
            setMatches(matchRes.data);
            setConnections(connRes.data);
            setCurrentIdx(0);
        } catch (err) {
            console.error('Error cargando matches:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData]),
    );

    // ── Acciones ──
    const handleAccept = async (match: MatchItem) => {
        if (!match) return;
        try {
            const { data } = await api.patch(`/matches/${match.id}/accept`);
            setConnections(prev => [...prev, { ...match, status: 'accepted' }]);
            if (data.mutual) {
                Alert.alert(
                    '¡Match mutuo! 🎉',
                    `${match.matchedUser.name} y tú habéis conectado. Se ha creado un chat directo.`,
                    [
                        { text: 'Ir al chat', onPress: () => goToChat(match.matchedUser.id, match.matchedUser.name) },
                        { text: 'Seguir', style: 'cancel' },
                    ],
                );
            }
        } catch {
            Alert.alert('Error', 'No se pudo aceptar el match');
        }
    };

    const handleReject = async (match: MatchItem) => {
        if (!match) return;
        try {
            await api.patch(`/matches/${match.id}/reject`);
        } catch {
            Alert.alert('Error', 'No se pudo rechazar el match');
        }
    };

    const handleButtonSwipe = (dir: 'left' | 'right') => {
        if (currentIdx >= matches.length) return;
        swipeOut(dir);
    };

    // ── Helpers ──
    const getInitials = (name: string) => {
        const p = name.split(' ');
        return p.length > 1 ? `${p[0][0]}${p[1][0]}`.toUpperCase() : name.substring(0, 2).toUpperCase();
    };

    const getInfo = (u: MatchedUser) => {
        const parts = [];
        if (u.academicOffer?.career?.name) parts.push(u.academicOffer.career.name);
        if (u.year) parts.push(`${u.year}º`);
        if (u.academicOffer?.university?.acronym) parts.push(u.academicOffer.university.acronym);
        return parts.join(' · ');
    };

    // ── Loading ──
    if (loading) {
        return (
            <View style={s.centered}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    // ── Render card de swipe ──
    const renderSwipeCard = (match: MatchItem, isTop: boolean) => {
        const u = match.matchedUser;
        const hasPhotos = u.photos && u.photos.length > 0;

        const handlePhotoTap = (evt: any) => {
            if (!hasPhotos || u.photos.length <= 1) return;
            const tapX = evt.nativeEvent.locationX;
            if (tapX > CARD_W / 2) {
                setPhotoIdx(prev => Math.min(prev + 1, u.photos.length - 1));
            } else {
                setPhotoIdx(prev => Math.max(prev - 1, 0));
            }
        };

        const cardStyle = isTop
            ? [s.card, { transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }] }]
            : [s.card, s.cardBehind, { transform: [{ scale: nextScale }] }];

        return (
            <Animated.View style={cardStyle} {...(isTop ? panResponder.panHandlers : {})}>
                {/* Foto / Avatar */}
                <TouchableOpacity
                    activeOpacity={1}
                    style={s.photoContainer}
                    onPress={handlePhotoTap}
                >
                    {hasPhotos ? (
                        <Image source={{ uri: u.photos[photoIdx] }} style={s.photo} />
                    ) : (
                        <View style={s.photoPlaceholder}>
                            <Text style={s.photoInitials}>{getInitials(u.name)}</Text>
                        </View>
                    )}

                    {/* Indicadores de foto */}
                    {hasPhotos && u.photos.length > 1 && (
                        <View style={s.photoIndicators}>
                            {u.photos.map((_, i) => (
                                <View
                                    key={i}
                                    style={[s.photoIndicator, i === photoIdx && s.photoIndicatorActive]}
                                />
                            ))}
                        </View>
                    )}

                    {/* Score badge */}
                    <View style={s.scoreBadge}>
                        <Feather name="zap" size={14} color="#FFF" />
                        <Text style={s.scoreText}>{match.affinity_score}%</Text>
                    </View>

                    {/* Overlay labels */}
                    {isTop && (
                        <>
                            <Animated.View style={[s.overlayLabel, s.likeLabel, { opacity: likeOpacity }]}>
                                <Text style={s.likeLabelText}>CONECTAR</Text>
                            </Animated.View>
                            <Animated.View style={[s.overlayLabel, s.nopeLabel, { opacity: nopeOpacity }]}>
                                <Text style={s.nopeLabelText}>PASAR</Text>
                            </Animated.View>
                        </>
                    )}

                    {/* Gradient info overlay */}
                    <View style={s.infoOverlay}>
                        <Text style={s.cardName}>{u.name}</Text>
                        <Text style={s.cardMeta}>{getInfo(u)}</Text>
                    </View>
                </TouchableOpacity>

                {/* Bottom info */}
                <View style={s.cardBody}>
                    {/* Reason IA */}
                    {match.reason && (
                        <View style={s.reasonBox}>
                            <Feather name="cpu" size={14} color={Colors.primary} />
                            <Text style={s.reasonText} numberOfLines={2}>{match.reason}</Text>
                        </View>
                    )}

                    {/* Intereses en común */}
                    {match.common_interests.length > 0 && (
                        <View style={s.interestsRow}>
                            <Text style={s.interestsLabel}>Intereses en común</Text>
                            <View style={s.chips}>
                                {match.common_interests.map((interest, i) => (
                                    <View key={i} style={s.chip}>
                                        <Text style={s.chipText}>{interest}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </View>
            </Animated.View>
        );
    };

    // ── Render conexión (tab Conectados) ──
    const goToChat = async (userId: string, userName: string) => {
        try {
            const { data } = await api.post(`/conversations/direct/${userId}`);
            nav.navigate('Chat', {
                screen: 'ChatDetail',
                params: {
                    conversationId: data.id,
                    title: userName,
                    type: 'direct',
                    participantIds: data.participant_ids,
                },
            });
        } catch {
            Alert.alert('Error', 'No se pudo abrir el chat');
        }
    };

    const renderConnection = (match: MatchItem) => {
        const u = match.matchedUser;
        return (
            <TouchableOpacity
                key={match.id}
                style={s.connCard}
                onPress={() => goToChat(u.id, u.name)}
            >
                <View style={s.connAvatar}>
                    {u.photos && u.photos.length > 0 ? (
                        <Image source={{ uri: u.photos[0] }} style={s.connPhoto} />
                    ) : (
                        <View style={s.connPhotoPlaceholder}>
                            <Text style={s.connInitials}>{getInitials(u.name)}</Text>
                        </View>
                    )}
                </View>
                <View style={s.connInfo}>
                    <Text style={s.connName}>{u.name}</Text>
                    <Text style={s.connMeta}>{getInfo(u)}</Text>
                </View>
                <View style={s.connScore}>
                    <Feather name="zap" size={12} color={Colors.primary} />
                    <Text style={s.connScoreText}>{match.affinity_score}%</Text>
                </View>
                <Feather name="message-circle" size={20} color={Colors.primary} />
            </TouchableOpacity>
        );
    };

    // ── Vista principal ──
    const currentMatch = matches[currentIdx];
    const nextMatch = matches[currentIdx + 1];
    const noMoreMatches = currentIdx >= matches.length;

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <Text style={s.headerTitle}>Matches IA</Text>
                <View style={s.tabs}>
                    <TouchableOpacity
                        style={[s.tab, activeTab === 'suggestions' && s.tabActive]}
                        onPress={() => setActiveTab('suggestions')}
                    >
                        <Feather name="heart" size={16} color={activeTab === 'suggestions' ? '#FFF' : Colors.textSecondary} />
                        <Text style={[s.tabText, activeTab === 'suggestions' && s.tabTextActive]}>
                            Sugeridos
                        </Text>
                        {matches.length - currentIdx > 0 && activeTab !== 'suggestions' && (
                            <View style={s.tabBadge}>
                                <Text style={s.tabBadgeText}>{matches.length - currentIdx}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[s.tab, activeTab === 'connections' && s.tabActive]}
                        onPress={() => setActiveTab('connections')}
                    >
                        <Feather name="users" size={16} color={activeTab === 'connections' ? '#FFF' : Colors.textSecondary} />
                        <Text style={[s.tabText, activeTab === 'connections' && s.tabTextActive]}>
                            Conectados
                        </Text>
                        {connections.length > 0 && activeTab !== 'connections' && (
                            <View style={[s.tabBadge, { backgroundColor: Colors.success }]}>
                                <Text style={s.tabBadgeText}>{connections.length}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {activeTab === 'suggestions' ? (
                <View style={s.swipeArea}>
                    {noMoreMatches ? (
                        <View style={s.empty}>
                            <Feather name="check-circle" size={56} color={Colors.grayLight} />
                            <Text style={s.emptyTitle}>¡Has visto todos los matches!</Text>
                            <Text style={s.emptySub}>
                                Nuevas sugerencias aparecerán cuando se unan más compañeros
                            </Text>
                            <TouchableOpacity style={s.refreshBtn} onPress={loadData}>
                                <Feather name="refresh-cw" size={16} color={Colors.primary} />
                                <Text style={s.refreshText}>Actualizar</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            {/* Card detrás */}
                            {nextMatch && renderSwipeCard(nextMatch, false)}
                            {/* Card principal */}
                            {currentMatch && renderSwipeCard(currentMatch, true)}

                            {/* Botones de acción */}
                            <View style={s.buttonsRow}>
                                <TouchableOpacity
                                    style={s.actionBtnReject}
                                    onPress={() => handleButtonSwipe('left')}
                                >
                                    <Feather name="x" size={28} color={Colors.error} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={s.actionBtnAccept}
                                    onPress={() => handleButtonSwipe('right')}
                                >
                                    <Feather name="heart" size={28} color={Colors.primary} />
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>
            ) : (
                <View style={s.connectionsContainer}>
                    {connections.length === 0 ? (
                        <View style={s.empty}>
                            <Feather name="users" size={56} color={Colors.grayLight} />
                            <Text style={s.emptyTitle}>Aún no has conectado</Text>
                            <Text style={s.emptySub}>
                                Desliza a la derecha en tus sugeridos para empezar a conectar
                            </Text>
                        </View>
                    ) : (
                        connections.map(c => renderConnection(c))
                    )}
                </View>
            )}
        </View>
    );
};

// ══════════════════════════════════════════
const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F7FA' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA' },

    // Header
    header: {
        paddingTop: 56, paddingBottom: 12,
        paddingHorizontal: Spacing.screenPadding,
        backgroundColor: Colors.white,
        borderBottomWidth: 1, borderBottomColor: Colors.border,
    },
    headerTitle: { fontSize: 26, fontWeight: '800', color: Colors.text, marginBottom: 12 },

    // Tabs
    tabs: { flexDirection: 'row', gap: 8 },
    tab: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingVertical: 8, paddingHorizontal: 16,
        borderRadius: 20, backgroundColor: '#F0F2F5',
    },
    tabActive: { backgroundColor: Colors.primary },
    tabText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
    tabTextActive: { color: '#FFF' },
    tabBadge: {
        backgroundColor: Colors.primary, minWidth: 20, height: 20,
        borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5,
    },
    tabBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },

    // Swipe area
    swipeArea: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 22 },

    // Card
    card: {
        width: CARD_W, height: CARD_H, borderRadius: 20,
        backgroundColor: Colors.white, position: 'absolute',
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12, shadowRadius: 16, elevation: 8,
        overflow: 'hidden',
    },
    cardBehind: { top: 8 },

    // Photo area
    photoContainer: { flex: 1, backgroundColor: '#E8EDF2' },
    photo: { width: '100%', height: '100%', resizeMode: 'cover' },
    photoPlaceholder: {
        width: '100%', height: '100%',
        justifyContent: 'center', alignItems: 'center',
        backgroundColor: Colors.secondary,
    },
    photoInitials: { fontSize: 64, fontWeight: '800', color: '#FFF', opacity: 0.9 },

    // Photo indicators
    photoIndicators: {
        position: 'absolute', top: 12, left: 16, right: 16,
        flexDirection: 'row', gap: 4,
    },
    photoIndicator: {
        flex: 1, height: 3, borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.4)',
    },
    photoIndicatorActive: {
        backgroundColor: '#FFF',
    },

    // Score
    scoreBadge: {
        position: 'absolute', top: 16, right: 16,
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12,
        paddingVertical: 6, borderRadius: 16,
    },
    scoreText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

    // Overlay labels
    overlayLabel: {
        position: 'absolute', top: '40%', padding: 10,
        borderWidth: 3, borderRadius: 10,
    },
    likeLabel: {
        left: 20, borderColor: '#4CD964',
        transform: [{ rotate: '-15deg' }],
    },
    likeLabelText: { fontSize: 28, fontWeight: '900', color: '#4CD964' },
    nopeLabel: {
        right: 20, borderColor: Colors.error,
        transform: [{ rotate: '15deg' }],
    },
    nopeLabelText: { fontSize: 28, fontWeight: '900', color: Colors.error },

    // Info overlay (gradient)
    infoOverlay: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 20, paddingBottom: 16, paddingTop: 50,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    cardName: { fontSize: 26, fontWeight: '800', color: '#FFF' },
    cardMeta: { fontSize: 15, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

    // Card body
    cardBody: { padding: 16 },
    reasonBox: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 8,
        backgroundColor: `${Colors.primary}10`, borderRadius: 10,
        padding: 10, marginBottom: 10,
    },
    reasonText: { fontSize: 13, color: Colors.primary, flex: 1, lineHeight: 18 },

    interestsRow: { gap: 6 },
    interestsLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
        backgroundColor: `${Colors.primary}15`,
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
    },
    chipText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },

    // Action buttons
    buttonsRow: {
        position: 'absolute', bottom: 40,
        flexDirection: 'row', gap: 24,
    },
    actionBtnReject: {
        width: 64, height: 64, borderRadius: 32,
        backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center',
        shadowColor: Colors.error, shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
        borderWidth: 2, borderColor: Colors.error,
    },
    actionBtnAccept: {
        width: 64, height: 64, borderRadius: 32,
        backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center',
        shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
        borderWidth: 2, borderColor: Colors.primary,
    },

    // Connections tab
    connectionsContainer: {
        flex: 1, paddingHorizontal: Spacing.screenPadding, paddingTop: 16,
    },
    connCard: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: Colors.white, borderRadius: 16, padding: 14,
        marginBottom: 10,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
    },
    connAvatar: { width: 50, height: 50 },
    connPhoto: { width: 50, height: 50, borderRadius: 25 },
    connPhotoPlaceholder: {
        width: 50, height: 50, borderRadius: 25,
        backgroundColor: Colors.secondary,
        justifyContent: 'center', alignItems: 'center',
    },
    connInitials: { color: '#FFF', fontSize: 18, fontWeight: '700' },
    connInfo: { flex: 1 },
    connName: { fontSize: 15, fontWeight: '600', color: Colors.text },
    connMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
    connScore: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        marginRight: 8,
    },
    connScoreText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

    // Empty
    empty: { alignItems: 'center', paddingHorizontal: 40, marginTop: 60 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 16, textAlign: 'center' },
    emptySub: { fontSize: 14, color: Colors.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 20 },
    refreshBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        marginTop: 20, paddingVertical: 10, paddingHorizontal: 20,
        borderRadius: 20, borderWidth: 1.5, borderColor: Colors.primary,
    },
    refreshText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
});