import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenContainer } from '../components/ScreenContainer';
import { StatusPill } from '../components/StatusPill';
import { appEnv } from '../config/env';
import { useAppTheme } from '../hooks/useAppTheme';
import type { RootStackParamList } from '../navigation/types';
import { createOpenClawClient } from '../services/openClawClient';
import { secureStorageService } from '../services/secureStorageService';
import { useAppStore } from '../store/appStore';
import { maskSecret, normalizeGatewayUrl } from '../utils/gateway';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export const SettingsScreen = ({ navigation }: Props) => {
  const theme = useAppTheme();
  const gatewayUrl = useAppStore((state) => state.gatewayUrl);
  const gatewayLabel = useAppStore((state) => state.gatewayLabel);
  const authToken = useAppStore((state) => state.authToken);
  const isMockMode = useAppStore((state) => state.isMockMode);
  const connectionMethod = useAppStore((state) => state.connectionMethod);
  const connectionStatus = useAppStore((state) => state.connectionStatus);
  const selectedAgentId = useAppStore((state) => state.selectedAgentId);
  const selectedSessionId = useAppStore((state) => state.selectedSessionId);
  const continuousMode = useAppStore((state) => state.continuousMode);
  const ttsEnabled = useAppStore((state) => state.ttsEnabled);
  const captionsEnabled = useAppStore((state) => state.captionsEnabled);
  const setGatewayContext = useAppStore((state) => state.setGatewayContext);
  const setConnectionStatus = useAppStore((state) => state.setConnectionStatus);
  const setContinuousMode = useAppStore((state) => state.setContinuousMode);
  const setTtsEnabled = useAppStore((state) => state.setTtsEnabled);
  const setCaptionsEnabled = useAppStore((state) => state.setCaptionsEnabled);
  const clearConnection = useAppStore((state) => state.clearConnection);
  const [manualUrl, setManualUrl] = useState(gatewayUrl);
  const [testingConnection, setTestingConnection] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const persistState = async (override?: Partial<Parameters<typeof secureStorageService.saveAppState>[0]>) => {
    await secureStorageService.saveAppState({
      gatewayUrl,
      gatewayLabel,
      authToken,
      selectedAgentId,
      selectedSessionId,
      isMockMode,
      continuousMode: useAppStore.getState().continuousMode,
      ttsEnabled: useAppStore.getState().ttsEnabled,
      captionsEnabled: useAppStore.getState().captionsEnabled,
      ...override,
    });
  };

  const handleSaveGateway = async () => {
    const normalized = normalizeGatewayUrl(manualUrl);

    if (!normalized && !isMockMode) {
      setErrorMessage('Enter a valid Gateway URL or enable mock mode.');
      return;
    }

    setGatewayContext({
      gatewayUrl: isMockMode ? 'mock://openclaw-gateway' : normalized,
      connectionMethod: isMockMode ? 'mock' : 'manual',
    });
    await persistState({
      gatewayUrl: isMockMode ? 'mock://openclaw-gateway' : normalized,
      isMockMode,
    });
    setErrorMessage(null);
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setErrorMessage(null);

    try {
      const client = createOpenClawClient({
        gatewayUrl: isMockMode ? 'mock://openclaw-gateway' : normalizeGatewayUrl(manualUrl),
        authToken,
        isMockMode,
      });
      const health = await client.connectToGateway(
        isMockMode ? 'mock://openclaw-gateway' : normalizeGatewayUrl(manualUrl),
      );
      setGatewayContext({
        gatewayUrl: isMockMode ? 'mock://openclaw-gateway' : normalizeGatewayUrl(manualUrl),
        gatewayLabel: health.gatewayName ?? gatewayLabel,
        isMockMode,
      });
      setConnectionStatus('connected');
      await persistState({
        gatewayUrl: isMockMode ? 'mock://openclaw-gateway' : normalizeGatewayUrl(manualUrl),
        gatewayLabel: health.gatewayName ?? gatewayLabel,
        isMockMode,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to reach the configured Gateway.';

      setConnectionStatus('offline', message);
      setErrorMessage(message);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleClearCredentials = async () => {
    Alert.alert(
      'Clear stored connection',
      'This removes the saved Gateway URL, selected session, and paired token from secure storage.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            void secureStorageService.clearAppState();
            clearConnection();
            navigation.reset({
              index: 0,
              routes: [{ name: 'Onboarding' }],
            });
          },
        },
      ],
    );
  };

  return (
    <ScreenContainer scroll contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Gateway settings</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          Control how this app syncs with OpenClaw, stores credentials, and handles voice behavior.
        </Text>
        <StatusPill status={connectionStatus} label={`${connectionMethod} connection`} />
      </View>

      <Card style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Gateway URL
        </Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setManualUrl}
          placeholder="http://openclaw.local:3333"
          placeholderTextColor={theme.colors.textMuted}
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
              color: theme.colors.text,
            },
          ]}
          value={manualUrl}
        />
        <Text style={[styles.helper, { color: theme.colors.textMuted }]}>
          Paired token: {maskSecret(authToken)}
        </Text>
        <PrimaryButton label="Save Gateway URL" onPress={() => void handleSaveGateway()} />
        <PrimaryButton
          label="Test connection"
          loading={testingConnection}
          onPress={() => void handleTestConnection()}
          variant="secondary"
        />
        <PrimaryButton
          label="Open connection flow"
          onPress={() => navigation.navigate('GatewayConnect')}
          variant="ghost"
        />
      </Card>

      {appEnv.enableMockMode ? (
        <Card style={styles.section}>
          <View style={styles.switchRow}>
            <View style={styles.switchMeta}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Mock mode
              </Text>
              <Text style={[styles.helper, { color: theme.colors.textMuted }]}>
                Keep a working demo mode available when no real OpenClaw Gateway is online.
              </Text>
            </View>
            <Switch
              onValueChange={(value) => {
                setGatewayContext({
                  isMockMode: value,
                  connectionMethod: value ? 'mock' : 'manual',
                });
                if (value) {
                  setManualUrl('mock://openclaw-gateway');
                }
              }}
              trackColor={{
                false: theme.colors.border,
                true: theme.colors.primary,
              }}
              value={isMockMode}
            />
          </View>
        </Card>
      ) : null}

      <Card style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Live voice transport
        </Text>
        <Text style={[styles.helper, { color: theme.colors.textMuted }]}>
          Spiq is configured for {appEnv.voiceTransport} voice sessions. The low-latency live path uses a Gateway-brokered LiveKit room and requires an iOS or Android development build, not Expo Go.
        </Text>
      </Card>

      <Card style={styles.section}>
        <View style={styles.switchRow}>
          <View style={styles.switchMeta}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Hands-free conversation mode
            </Text>
            <Text style={[styles.helper, { color: theme.colors.textMuted }]}>
              Match ChatGPT-style voice flow by reopening the mic after each reply. Turn this off to use push-to-talk instead.
            </Text>
          </View>
          <Switch
            onValueChange={(value) => {
              setContinuousMode(value);
              void persistState({
                continuousMode: value,
              });
            }}
            trackColor={{
              false: theme.colors.border,
              true: theme.colors.primary,
            }}
            value={continuousMode}
          />
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchMeta}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Captions in voice mode
            </Text>
            <Text style={[styles.helper, { color: theme.colors.textMuted }]}>
              Show compact live captions on the voice conversation screen.
            </Text>
          </View>
          <Switch
            onValueChange={(value) => {
              setCaptionsEnabled(value);
              void persistState({
                captionsEnabled: value,
              });
            }}
            trackColor={{
              false: theme.colors.border,
              true: theme.colors.primary,
            }}
            value={captionsEnabled}
          />
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchMeta}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Speak agent replies
            </Text>
            <Text style={[styles.helper, { color: theme.colors.textMuted }]}>
              Use device text-to-speech playback for each agent response in mock or legacy mode. Live voice sessions stream agent audio directly instead.
            </Text>
          </View>
          <Switch
            disabled={!isMockMode && appEnv.voiceTransport === 'livekit'}
            onValueChange={(value) => {
              setTtsEnabled(value);
              void persistState({
                ttsEnabled: value,
              });
            }}
            trackColor={{
              false: theme.colors.border,
              true: theme.colors.primary,
            }}
            value={ttsEnabled}
          />
        </View>
      </Card>

      <PrimaryButton
        label="Clear stored credentials"
        onPress={() => void handleClearCredentials()}
        variant="danger"
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
    gap: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  section: {
    gap: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  input: {
    borderWidth: 1,
    fontSize: 16,
    minHeight: 54,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  helper: {
    fontSize: 13,
    lineHeight: 20,
  },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  switchMeta: {
    flex: 1,
    gap: 4,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
