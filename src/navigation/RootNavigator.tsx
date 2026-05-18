import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAppTheme } from '../hooks/useAppTheme';
import { useAppStore } from '../store/appStore';
import { AgentMultiSelectScreen } from '../screens/AgentMultiSelectScreen';
import { SwipeAgentSelectorScreen } from '../screens/SwipeAgentSelectorScreen';
import { ConferenceScreen } from '../screens/ConferenceScreen';
import { ConversationHistoryScreen } from '../screens/ConversationHistoryScreen';
import { GatewayConnectScreen } from '../screens/GatewayConnectScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { PairingScreen } from '../screens/PairingScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { VoiceChatScreen } from '../screens/VoiceChatScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator = () => {
  const theme = useAppTheme();
  const gatewayUrl = useAppStore((state) => state.gatewayUrl);
  const authToken = useAppStore((state) => state.authToken);
  const selectedSessionId = useAppStore((state) => state.selectedSessionId);

  const initialRouteName = !gatewayUrl
    ? 'Onboarding'
    : !authToken
      ? 'Pairing'
      : !selectedSessionId
        ? 'AgentSelector'
        : 'VoiceChat';

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        animation: 'slide_from_right',
        contentStyle: {
          backgroundColor: theme.colors.background,
        },
        headerStyle: {
          backgroundColor: theme.colors.background,
        },
        headerShadowVisible: false,
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          color: theme.colors.text,
          fontWeight: '700',
        },
      }}
    >
      <Stack.Screen
        component={OnboardingScreen}
        name="Onboarding"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        component={GatewayConnectScreen}
        name="GatewayConnect"
        options={{
          title: 'Sync with OpenClaw',
        }}
      />
      <Stack.Screen
        component={PairingScreen}
        name="Pairing"
        options={{
          title: 'Secure Pairing',
        }}
      />
      <Stack.Screen
        component={SwipeAgentSelectorScreen}
        name="AgentSelector"
        options={{
          title: 'Pick Your Team',
        }}
      />
      <Stack.Screen
        component={AgentMultiSelectScreen}
        name="AgentMultiSelect"
        options={{
          title: 'Conference Agents',
        }}
      />
      <Stack.Screen
        component={VoiceChatScreen}
        name="VoiceChat"
        options={{
          title: 'Voice Chat',
        }}
      />
      <Stack.Screen
        component={ConferenceScreen}
        name="Conference"
        options={{
          title: 'Conference Call',
        }}
      />
      <Stack.Screen
        component={ConversationHistoryScreen}
        name="ConversationHistory"
        options={{
          title: 'Conversation History',
        }}
      />
      <Stack.Screen
        component={SettingsScreen}
        name="Settings"
        options={{
          title: 'Settings',
        }}
      />
    </Stack.Navigator>
  );
};
