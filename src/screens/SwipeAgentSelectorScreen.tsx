import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenContainer } from '../components/ScreenContainer';
import { StatusPill } from '../components/StatusPill';
import { SwipeableAgentCard } from '../components/SwipeableAgentCard';
import { useAppTheme } from '../hooks/useAppTheme';
import type { RootStackParamList } from '../navigation/types';
import { createOpenClawClient } from '../services/openClawClient';
import { secureStorageService } from '../services/secureStorageService';
import { useAppStore } from '../store/appStore';

type Props = NativeStackScreenProps<RootStackParamList, 'AgentSelector'>;

export const SwipeAgentSelectorScreen = ({ navigation }: Props) => {
  const theme = useAppTheme();
  const gatewayUrl = useAppStore((state) => state.gatewayUrl);
  const gatewayLabel = useAppStore((state) => state.gatewayLabel);
  const authToken = useAppStore((state) => state.authToken);
  const isMockMode = useAppStore((state) => state.isMockMode);
  const agents = useAppStore((state) => state.agents);
  const continuousMode = useAppStore((state) => state.continuousMode);
  const ttsEnabled = useAppStore((state) => state.ttsEnabled);
  const setAgents = useAppStore((state) => state.setAgents);
  const setSelectedAgentId = useAppStore((state) => state.setSelectedAgentId);
  const setSelectedSessionId = useAppStore((state) => state.setSelectedSessionId);
  const setConversationHistory = useAppStore((state) => state.setConversationHistory);
  const upsertSession = useAppStore((state) => state.upsertSession);
  const invitedAgentIds = useAppStore((state) => state.invitedAgentIds);
  const toggleAgentInvitation = useAppStore((state) => state.toggleAgentInvitation);
  const setConferenceMode = useAppStore((state) => state.setConferenceMode);
  const clearConference = useAppStore((state) => state.clearConference);

  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [buttonAnim] = useState(new Animated.Value(0));

  const selectedCount = invitedAgentIds.length;
  const hasSelection = selectedCount > 0;

  const createClient = useCallback(
    () =>
      createOpenClawClient({
        gatewayUrl,
        authToken,
        isMockMode,
      }),
    [gatewayUrl, authToken, isMockMode],
  );

  useEffect(() => {
    Animated.spring(buttonAnim, {
      toValue: hasSelection ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [hasSelection, buttonAnim]);

  useEffect(() => {
    clearConference();
    void loadAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAgents = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const loadedAgents = await createClient().listAgents();
      setAgents(loadedAgents);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to load agents.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddAgent = (agentId: string) => {
    if (!invitedAgentIds.includes(agentId)) {
      toggleAgentInvitation(agentId);
    }
  };

  const handleRemoveAgent = (agentId: string) => {
    if (invitedAgentIds.includes(agentId)) {
      toggleAgentInvitation(agentId);
    }
  };

  const handleStartConversation = async () => {
    if (selectedCount === 0) return;

    setStarting(true);
    setErrorMessage(null);

    try {
      const client = createClient();

      if (selectedCount === 1) {
        // Single agent: use VoiceChat flow
        const agentId = invitedAgentIds[0];
        setSelectedAgentId(agentId);
        setConferenceMode(false);

        const session = await client.createSession(agentId);
        upsertSession(session);
        const history = await client.getConversationHistory(session.id);
        setConversationHistory(session.id, history);
        setSelectedSessionId(session.id);

        await secureStorageService.updateAppState({
          gatewayUrl,
          gatewayLabel,
          authToken,
          selectedAgentId: agentId,
          selectedSessionId: session.id,
          isMockMode,
          continuousMode,
          ttsEnabled,
        });

        navigation.navigate('VoiceChat');
      } else {
        // Multiple agents: use Conference flow
        setConferenceMode(true);
        navigation.navigate('Conference');
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to start the conversation.',
      );
    } finally {
      setStarting(false);
    }
  };

  const getButtonLabel = () => {
    if (selectedCount === 0) return '';
    if (selectedCount === 1) {
      const agent = agents.find((a) => a.id === invitedAgentIds[0]);
      return `Chat with ${agent?.name ?? 'agent'}`;
    }
    return `Start conference (${selectedCount} agents)`;
  };

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <ScreenContainer scroll contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Pick Your Team
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
            Swipe right on an agent to add them to your conversation.
          </Text>
          <StatusPill
            status="connected"
            label={gatewayLabel ?? 'Gateway synced'}
          />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textMuted }]}>
              Loading agents...
            </Text>
          </View>
        ) : (
          <View style={styles.agentList}>
            {agents.map((agent) => (
              <SwipeableAgentCard
                key={agent.id}
                agent={agent}
                isSelected={invitedAgentIds.includes(agent.id)}
                onSwipeAdd={() => handleAddAgent(agent.id)}
                onSwipeRemove={() => handleRemoveAgent(agent.id)}
              />
            ))}
            {agents.length === 0 && (
              <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
                No agents available.
              </Text>
            )}
          </View>
        )}

        {errorMessage && (
          <Text style={[styles.errorText, { color: theme.colors.danger }]}>
            {errorMessage}
          </Text>
        )}

        <PrimaryButton
          label="Open settings"
          onPress={() => navigation.navigate('Settings')}
          variant="ghost"
        />
      </ScreenContainer>

      {/* Floating action button */}
      <Animated.View
        style={[
          styles.floatingButtonContainer,
          {
            backgroundColor: theme.colors.background,
            borderTopColor: theme.colors.border,
            opacity: buttonAnim,
            transform: [
              {
                translateY: buttonAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [100, 0],
                }),
              },
            ],
          },
        ]}
        pointerEvents={hasSelection ? 'auto' : 'none'}
      >
        <PrimaryButton
          label={getButtonLabel()}
          onPress={() => void handleStartConversation()}
          disabled={starting || !hasSelection}
        />
        {starting && (
          <ActivityIndicator
            style={styles.startingIndicator}
            color={theme.colors.primary}
          />
        )}
      </Animated.View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  container: {
    gap: 18,
    paddingBottom: 120,
  },
  header: {
    gap: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  loadingContainer: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 14,
  },
  agentList: {
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
  },
  floatingButtonContainer: {
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    paddingBottom: 34,
    paddingHorizontal: 20,
    paddingTop: 16,
    position: 'absolute',
    right: 0,
  },
  startingIndicator: {
    marginTop: 8,
  },
});
