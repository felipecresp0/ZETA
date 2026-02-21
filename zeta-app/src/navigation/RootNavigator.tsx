// src/navigation/RootNavigator.tsx
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';
import { SetupProfileScreen } from '../screens/auth/SetupProfileScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { Colors } from '../theme/colors';

const OnboardingStack = createNativeStackNavigator();
const AppStack = createNativeStackNavigator();

export const RootNavigator: React.FC = () => {
    const { user, token, loading, isOnboardingComplete } = useAuth();

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <NavigationContainer>
            {!token ? (
                <AuthStack />
            ) : !isOnboardingComplete ? (
                <OnboardingStack.Navigator screenOptions={{ headerShown: false }}>
                    <OnboardingStack.Screen name="SetupProfile" component={SetupProfileScreen} />
                </OnboardingStack.Navigator>
            ) : (
                // MainTabs + pantallas modales (Profile, etc.)
                <AppStack.Navigator screenOptions={{ headerShown: false }}>
                    <AppStack.Screen name="Main" component={MainTabs} />
                    <AppStack.Screen
                        name="Profile"
                        component={ProfileScreen}
                        options={{ animation: 'slide_from_right' }}
                    />
                </AppStack.Navigator>
            )}
        </NavigationContainer>
    );
};