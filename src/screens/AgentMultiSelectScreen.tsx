import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenContainer } from '../components/ScreenContainer';
import { StatusPill } from '../components/StatusPill';
import { useAppTheme } from '../hooks/useAppTheme';
import type { RootStackParamList } from '../navigation/types';
import { createOpenClawClient } from '../services/openClawClient';
import { useAppStore } from '../store/appStore';

type Props = NativeStackScreenProps<RootStackParamList, 'AgentMultiSelect'>;

export const AgentMultiSelectScreen = ({ navigation }: Props) => {
  const theme = useAppTheme();
  const gatewayUrl = useAppStore((state) => state.gatewayUrl);
  const gatewayLabel = useAppStore((state) => state.gatewayLabel);
  const authToken = useAppStore((state) => state.authToken);
  const isMockMode = useAppStore((state) => state.isMockMode);
  const agents = useAppStore((state) => state.agents);
  const invitedAgentIds = useAppStore((state) => state.invitedAgentIds);
  const setAgents = useAppStore((state) => state.setAgents);
  const toggleAgentInvitation = useAppStore((state) => state.toggleAgentInvitation);
  const setConferenceMode = useAppStore((state) => state.setConferenceMode);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createClient = useCallback(
    () =>
      createOpenClawClient({
        gatewayUrl,
        authToken,
        isMockMode,
      }),
    [gatewayUrl, authToken, isMockMode],
  );

  const loadAgents = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const loadedAgents = await createClient().listAgents();
      setAgents(loadedAgents);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load OpenClaw agents.',
      );
    } finally {
      setLoading(false);
    }
  }, [createClient, setAgents]);

  useEffect(() => {
    if (agents.length === 0) {
      void loadAgents();
    }
  }, [agents.length, loadAgents]);

  const availableAgents = agents.filter(
    (agent) => agent.status === 'available',
  );
  const selectedCount = invitedAgentIds.length;
  const canStartConference = selectedCount >= 2;

  const handleStartConference = () => {
    setConferenceMode(true);
    navigation.navigate('Conference');
  };

  const handleToggleAgent = (agentId: string) => {
    toggleAgentInvitation(agentId);
  };

  return (
    <ScreenContainer scroll contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Multi-Agent Conference
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          Select 2 or more agents to start a conference call. Agents will hear
          and respond to each other.
        </Text>
        <StatusPill
          status="connected"
          label={gatewayLabel ?? 'Gateway synced'}
        />
      </View>

      <Card style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Available Agents
          </Text>
          {loading ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            <Text style={[styles.selectedCount, { color: theme.colors.accent }]}>
              {selectedCount} selected
            </Text>
          )}
        </View>

        <View style={styles.agentList}>
          {availableAgents.map((agent) => {
            const isSelected = invitedAgentIds.includes(agent.id);

            return (
              <Pressable
                key={agent.id}
                onPress={() => handleToggleAgent(agent.id)}
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
                  <View style={styles.agentInfo}>
                    {/* Checkbox indicator */}
                    <View
                      style={[
                        styles.checkbox,
                        {
                          backgroundColor: isSelected
                            ? theme.colors.primary
                            : 'transparent',
                          borderColor: isSelected
                            ? theme.colors.primary
                            : theme.colors.border,
                          borderRadius: theme.radii.sm,
                        },
                      ]}
                    >
                      {isSelected && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </View>
                    <Text
                      style={[styles.agentName, { color: theme.colors.text }]}
                    >
                      {agent.name}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.agentStatus,
                      { color: theme.colors.success },
                    ]}
                  >
                    Available
                  </Text>
                </View>
                <Text
                  style={[
                    styles.agentDescription,
                    { color: theme.colors.textMuted },
                  ]}
                >
                  {agent.description}
                </Text>
                <Text
                  style={[styles.agentCaps, { color: theme.colors.textMuted }]}
                >
                  {agent.capabilities.join(' • ')}
                </Text>
              </Pressable>
            );
          })}

          {availableAgents.length === 0 && !loading && (
            <Text
              style={[styles.emptyState, { color: theme.colors.textMuted }]}
            >
              No available agents found. Agents must be online and available to
              join a conference.
            </Text>
          )}
        </View>
      </Card>

      <View style={styles.actions}>
        <PrimaryButton
          label={`Start Conference (${selectedCount} agents)`}
          onPress={handleStartConference}
          disabled={!canStartConference}
        />
        {!canStartConference && selectedCount > 0 && (
          <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
            Select at least one more agent to start
          </Text>
        )}
        <PrimaryButton
          label="Back to agent selector"
          onPress={() => navigation.goBack()}
          variant="ghost"
        />
      </View>

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
  selectedCount: {
    fontSize: 14,
    fontWeight: '700',
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
  agentInfo: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  checkbox: {
    alignItems: 'center',
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
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
    paddingLeft: 34,
  },
  agentCaps: {
    fontSize: 13,
    fontWeight: '600',
    paddingLeft: 34,
  },
  actions: {
    gap: 12,
  },
  hint: {
    fontSize: 13,
    textAlign: 'center',
  },
  emptyState: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
