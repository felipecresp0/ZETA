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
import { UserDetailScreen } from '../screens/chat/UserDetailScreen';
import GroupDetailScreen from '../screens/groups/GroupDetailScreen';
import { SearchScreen } from '../screens/search/SearchScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { EventDetailScreen } from '../screens/events/EventDetailScreen';
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
                    <AppStack.Screen
                        name="UserDetail"
                        component={UserDetailScreen}
                        options={{ animation: 'slide_from_right' }}
                    />
                    <AppStack.Screen
                        name="GroupDetailModal"
                        component={GroupDetailScreen}
                        options={{ animation: 'slide_from_right' }}
                    />
                    <AppStack.Screen
                        name="Search"
                        component={SearchScreen}
                        options={{ animation: 'slide_from_right' }}
                    />
                    <AppStack.Screen
                        name="Notifications"
                        component={NotificationsScreen}
                        options={{ animation: 'slide_from_right' }}
                    />
                    <AppStack.Screen
                        name="EventDetail"
                        component={EventDetailScreen}
                        options={{ animation: 'slide_from_right' }}
                    />
                </AppStack.Navigator>
            )}
        </NavigationContainer>
    );
};