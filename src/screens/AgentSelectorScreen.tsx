import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenContainer } from '../components/ScreenContainer';
import { StatusPill } from '../components/StatusPill';
import { useAppTheme } from '../hooks/useAppTheme';
import type { RootStackParamList } from '../navigation/types';
import { createOpenClawClient } from '../services/openClawClient';
import { secureStorageService } from '../services/secureStorageService';
import { useAppStore } from '../store/appStore';

type Props = NativeStackScreenProps<RootStackParamList, 'AgentSelector'>;

export const AgentSelectorScreen = ({ navigation }: Props) => {
  const theme = useAppTheme();
  const gatewayUrl = useAppStore((state) => state.gatewayUrl);
  const gatewayLabel = useAppStore((state) => state.gatewayLabel);
  const authToken = useAppStore((state) => state.authToken);
  const isMockMode = useAppStore((state) => state.isMockMode);
  const agents = useAppStore((state) => state.agents);
  const sessions = useAppStore((state) => state.sessions);
  const selectedAgentId = useAppStore((state) => state.selectedAgentId);
  const continuousMode = useAppStore((state) => state.continuousMode);
  const ttsEnabled = useAppStore((state) => state.ttsEnabled);
  const setAgents = useAppStore((state) => state.setAgents);
  const setSelectedAgentId = useAppStore((state) => state.setSelectedAgentId);
  const setSessions = useAppStore((state) => state.setSessions);
  const setSelectedSessionId = useAppStore((state) => state.setSelectedSessionId);
  const setConversationHistory = useAppStore((state) => state.setConversationHistory);
  const upsertSession = useAppStore((state) => state.upsertSession);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedAgent =
    agents.find((agent) => agent.id === selectedAgentId) ?? agents[0] ?? null;

  const createClient = () =>
    createOpenClawClient({
      gatewayUrl,
      authToken,
      isMockMode,
    });

  const loadSessions = async (agentId: string) => {
    setLoadingSessions(true);
    setErrorMessage(null);

    try {
      const loadedSessions = await createClient().listSessions(agentId);
      setSelectedAgentId(agentId);
      setSessions(loadedSessions);
      await secureStorageService.updateAppState({
        gatewayUrl,
        gatewayLabel,
        authToken,
        selectedAgentId: agentId,
        selectedSessionId: null,
        isMockMode,
        continuousMode,
        ttsEnabled,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load sessions for that agent.',
      );
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadAgents = async () => {
    setLoadingAgents(true);
    setErrorMessage(null);

    try {
      const loadedAgents = await createClient().listAgents();
      setAgents(loadedAgents);

      if (loadedAgents.length > 0) {
        const preferredAgentId = selectedAgentId ?? loadedAgents[0].id;
        await loadSessions(preferredAgentId);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to load OpenClaw agents.',
      );
    } finally {
      setLoadingAgents(false);
    }
  };

  useEffect(() => {
    void loadAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResumeSession = async (sessionId: string) => {
    if (!selectedAgent) {
      return;
    }

    setLoadingSessions(true);

    try {
      const history = await createClient().getConversationHistory(sessionId);
      setConversationHistory(sessionId, history);
      setSelectedSessionId(sessionId);
      await secureStorageService.updateAppState({
        gatewayUrl,
        gatewayLabel,
        authToken,
        selectedAgentId: selectedAgent.id,
        selectedSessionId: sessionId,
        isMockMode,
        continuousMode,
        ttsEnabled,
      });
      navigation.navigate('VoiceChat');
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load conversation history for this session.',
      );
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleCreateSession = async () => {
    if (!selectedAgent) {
      return;
    }

    setLoadingSessions(true);
    setErrorMessage(null);

    try {
      const session = await createClient().createSession(selectedAgent.id);
      upsertSession(session);
      const history = await createClient().getConversationHistory(session.id);
      setConversationHistory(session.id, history);
      setSelectedSessionId(session.id);
      await secureStorageService.updateAppState({
        gatewayUrl,
        gatewayLabel,
        authToken,
        selectedAgentId: selectedAgent.id,
        selectedSessionId: session.id,
        isMockMode,
        continuousMode,
        ttsEnabled,
      });
      navigation.navigate('VoiceChat');
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to create a new voice session.',
      );
    } finally {
      setLoadingSessions(false);
    }
  };

  return (
    <ScreenContainer scroll contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Pick an OpenClaw agent
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          Connected to {(gatewayLabel ?? gatewayUrl) || 'your Gateway'}. Choose an agent, then start or resume a voice session.
        </Text>
        <StatusPill status="connected" label={gatewayLabel ?? 'Gateway synced'} />
      </View>

      <Card style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Agents</Text>
          {loadingAgents ? <ActivityIndicator color={theme.colors.primary} /> : null}
        </View>
        <View style={styles.agentList}>
          {agents.map((agent) => {
            const isSelected = agent.id === selectedAgent?.id;

            return (
              <Pressable
                key={agent.id}
                onPress={() => void loadSessions(agent.id)}
                style={[
                  styles.agentCard,
                  {
                    backgroundColor: isSelected
                      ? theme.colors.primarySoft
                      : theme.colors.surfaceMuted,
                    borderColor: isSelected
                      ? theme.colors.primary
                      : theme.colors.border,
                    borderRadius: theme.radii.md,
                  },
                ]}
              >
                <View style={styles.agentHeader}>
                  <Text style={[styles.agentName, { color: theme.colors.text }]}>
                    {agent.name}
                  </Text>
                  <Text
                    style={[
                      styles.agentStatus,
                      {
                        color:
                          agent.status === 'available'
                            ? theme.colors.success
                            : agent.status === 'busy'
                              ? theme.colors.warning
                              : theme.colors.danger,
                      },
                    ]}
                  >
                    {agent.status}
                  </Text>
                </View>
                <Text style={[styles.agentDescription, { color: theme.colors.textMuted }]}>
                  {agent.description}
                </Text>
                <Text style={[styles.agentCaps, { color: theme.colors.textMuted }]}>
                  {agent.capabilities.join(' • ')}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Sessions {selectedAgent ? `for ${selectedAgent.name}` : ''}
          </Text>
          {loadingSessions ? <ActivityIndicator color={theme.colors.primary} /> : null}
        </View>
        <PrimaryButton
          label="Start new voice session"
          onPress={() => void handleCreateSession()}
        />
        {sessions.length > 0 ? (
          <View style={styles.sessionList}>
            {sessions.map((session) => (
              <Pressable
                key={session.id}
                onPress={() => void handleResumeSession(session.id)}
                style={[
                  styles.sessionCard,
                  {
                    backgroundColor: theme.colors.surfaceMuted,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radii.md,
                  },
                ]}
              >
                <Text style={[styles.sessionTitle, { color: theme.colors.text }]}>
                  {session.title}
                </Text>
                <Text style={[styles.sessionPreview, { color: theme.colors.textMuted }]}>
                  {session.preview}
                </Text>
                <Text style={[styles.sessionMeta, { color: theme.colors.textMuted }]}>
                  {session.messageCount} messages
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={[styles.emptyState, { color: theme.colors.textMuted }]}>
            No existing sessions for this agent yet.
          </Text>
        )}
      </Card>

      <PrimaryButton
        label="Start multi-agent conference"
        onPress={() => navigation.navigate('AgentMultiSelect')}
        variant="secondary"
      />

      <PrimaryButton
        label="Open settings"
        onPress={() => navigation.navigate('Settings')}
        variant="ghost"
      />

      {errorMessage ? (
        <Text style={[styles.errorText, { color: theme.colors.danger }]}>
          {errorMessage}
        </Text>
      ) : null}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 18,
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
  section: {
    gap: 16,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  agentList: {
    gap: 12,
  },
  agentCard: {
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  agentHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  agentName: {
    fontSize: 17,
    fontWeight: '800',
  },
  agentStatus: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  agentDescription: {
    fontSize: 14,
    lineHeight: 21,
  },
  agentCaps: {
    fontSize: 13,
    fontWeight: '600',
  },
  sessionList: {
    gap: 12,
  },
  sessionCard: {
    borderWidth: 1,
    gap: 6,
    padding: 14,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sessionPreview: {
    fontSize: 14,
    lineHeight: 20,
  },
  sessionMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
