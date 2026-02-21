import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { SetupProfileScreen } from '../screens/auth/SetupProfileScreen';

export type AuthStackParams = {
    Welcome: undefined;
    Login: undefined;
    Register: undefined;
    SetupProfile: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParams>();

export const AuthStack: React.FC = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="SetupProfile" component={SetupProfileScreen} />
    </Stack.Navigator>
);