// src/navigation/ChatStack.tsx
// Stack para la sección de chat: lista → detalle
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ConversationsScreen } from '../screens/chat/ConversationsScreen';
import { ChatScreen } from '../screens/chat/ChatScreen';

export type ChatStackParams = {
    Conversations: undefined;
    ChatDetail: {
        conversationId: string;
        title: string;
        type: 'direct' | 'group';
        participantIds: string[];
    };
};

const Stack = createNativeStackNavigator<ChatStackParams>();

export const ChatStack: React.FC = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Conversations" component={ConversationsScreen} />
        <Stack.Screen name="ChatDetail" component={ChatScreen} />
    </Stack.Navigator>
);

// ── USO EN MainTabs.tsx ──
// En tu tab de chat, usa ChatStack en vez de una pantalla directa:
//
// <Tab.Screen
//   name="Chat"
//   component={ChatStack}
//   options={{
//     tabBarLabel: 'Chat',
//     tabBarIcon: ({ color, size }) => <Feather name="message-circle" size={size} color={color} />,
//   }}
// />