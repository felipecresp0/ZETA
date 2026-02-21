import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

interface Props {
    name: string;
    photo?: string | null;
    size?: number;
}

export const ZAvatar: React.FC<Props> = ({ name, photo, size = 44 }) => {
    const initials = name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();

    if (photo) {
        return (
            <Image
                source={{ uri: photo }}
                style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
            />
        );
    }

    return (
        <View style={[styles.fallback, {
            width: size, height: size, borderRadius: size / 2,
        }]}>
            <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    image: { backgroundColor: Colors.grayLight },
    fallback: {
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    initials: { color: Colors.white, fontWeight: '700' },
});