// =============================================
// src/navigation/GroupsStack.tsx
// Stack de navegación para Grupos
// =============================================
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import GroupsScreen from '../screens/groups/GroupsScreen';
import CreateGroupScreen from '../screens/groups/CreateGroupScreen';
import GroupDetailScreen from '../screens/groups/GroupDetailScreen';

const Stack = createNativeStackNavigator();

export default function GroupsStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="GroupsList" component={GroupsScreen} />
            <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
            <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
        </Stack.Navigator>
    );
}

// =============================================
// INTEGRACIÓN EN MainTabs.tsx
// =============================================
// Añade este import en MainTabs.tsx:
//
//   import GroupsStack from './GroupsStack';
//
// Y añade este Tab.Screen dentro del <Tab.Navigator>:
//
//   <Tab.Screen
//     name="GroupsTab"
//     component={GroupsStack}
//     options={{
//       tabBarLabel: 'Grupos',
//       tabBarIcon: ({ color, size }) => (
//         <Ionicons name="people" size={size} color={color} />
//       ),
//     }}
//   />
//
// Ejemplo completo de MainTabs con Grupos:
//
// <Tab.Navigator screenOptions={{
//   headerShown: false,
//   tabBarActiveTintColor: '#0298D1',
//   tabBarInactiveTintColor: '#999',
//   tabBarStyle: { paddingBottom: 8, height: 60 },
// }}>
//   <Tab.Screen name="Home" component={HomeScreen} options={{
//     tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
//   }} />
//   <Tab.Screen name="GroupsTab" component={GroupsStack} options={{
//     tabBarLabel: 'Grupos',
//     tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
//   }} />
//   <Tab.Screen name="ChatTab" component={ChatStack} options={{
//     tabBarLabel: 'Chat',
//     tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} />,
//   }} />
//   <Tab.Screen name="CalendarTab" component={CalendarScreen} options={{
//     tabBarLabel: 'Calendario',
//     tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
//   }} />
// </Tab.Navigator>