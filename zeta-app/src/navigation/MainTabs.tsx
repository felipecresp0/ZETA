import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { HomeScreen } from '../screens/home/HomeScreen';
import { MatchScreen } from '../screens/match/MatchScreen';
import GroupsStack from './GroupsStack';  // ← Stack en vez de Screen directa
import { CalendarScreen } from '../screens/calendar/CalendarScreen';
import { ChatStack } from './ChatStack';

const Tab = createBottomTabNavigator();

const tabIcon = (name: string, focused: boolean) => {
    const icons: Record<string, string> = {
        Home: focused ? 'home' : 'home-outline',
        Match: focused ? 'heart' : 'heart-outline',
        Grupos: focused ? 'people' : 'people-outline',
        Chat: focused ? 'chatbubbles' : 'chatbubbles-outline',
        Calendario: focused ? 'calendar' : 'calendar-outline',
    };
    return icons[name] || 'ellipse';
};

export const MainTabs: React.FC = () => (
    <Tab.Navigator
        screenOptions={({ route }) => ({
            headerShown: false,
            tabBarIcon: ({ focused }) => (
                <Ionicons
                    name={tabIcon(route.name, focused) as any}
                    size={24}
                    color={focused ? Colors.primary : Colors.gray}
                />
            ),
            tabBarActiveTintColor: Colors.primary,
            tabBarInactiveTintColor: Colors.gray,
            tabBarStyle: {
                height: 60,
                paddingBottom: 8,
                paddingTop: 8,
                backgroundColor: Colors.white,
                borderTopWidth: 1,
                borderTopColor: Colors.border,
            },
            tabBarLabelStyle: {
                fontSize: 11,
                fontWeight: '600',
            },
        })}
    >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Match" component={MatchScreen} />
        <Tab.Screen name="Grupos" component={GroupsStack} />
        <Tab.Screen name="Chat" component={ChatStack} />
        <Tab.Screen name="Calendario" component={CalendarScreen} />
    </Tab.Navigator>
);