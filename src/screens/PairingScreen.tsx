import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenContainer } from '../components/ScreenContainer';
import { StatusPill } from '../components/StatusPill';
import { useAppTheme } from '../hooks/useAppTheme';
import type { RootStackParamList } from '../navigation/types';
import { createOpenClawClient } from '../services/openClawClient';
import { secureStorageService } from '../services/secureStorageService';
import { useAppStore } from '../store/appStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Pairing'>;

export const PairingScreen = ({ navigation, route }: Props) => {
  const theme = useAppTheme();
  const gatewayUrl = useAppStore((state) => state.gatewayUrl);
  const gatewayLabel = useAppStore((state) => state.gatewayLabel);
  const isMockMode = useAppStore((state) => state.isMockMode);
  const continuousMode = useAppStore((state) => state.continuousMode);
  const ttsEnabled = useAppStore((state) => state.ttsEnabled);
  const captionsEnabled = useAppStore((state) => state.captionsEnabled);
  const setGatewayContext = useAppStore((state) => state.setGatewayContext);
  const setConnectionStatus = useAppStore((state) => state.setConnectionStatus);
  const setAgents = useAppStore((state) => state.setAgents);
  const [pairingCode, setPairingCode] = useState(
    route.params?.pairingCode ?? (route.params?.isMockMode ? 'demo-openclaw' : ''),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeGatewayUrl = route.params?.gatewayUrl ?? gatewayUrl;
  const activeMockMode = route.params?.isMockMode ?? isMockMode;

  const handlePair = async () => {
    if (!activeGatewayUrl) {
      setErrorMessage('No Gateway URL is set. Return to the connection screen and try again.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setConnectionStatus('pairing');

    try {
      const pairingClient = createOpenClawClient({
        gatewayUrl: activeGatewayUrl,
        isMockMode: activeMockMode,
      });
      const pairingResult = await pairingClient.pairWithGateway(
        pairingCode.trim() || 'demo-openclaw',
      );
      const authedClient = createOpenClawClient({
        gatewayUrl: activeGatewayUrl,
        authToken: pairingResult.token,
        isMockMode: activeMockMode,
      });
      const agents = await authedClient.listAgents();

      setGatewayContext({
        gatewayUrl: activeGatewayUrl,
        gatewayLabel: pairingResult.gatewayLabel ?? gatewayLabel,
        authToken: pairingResult.token,
        isMockMode: activeMockMode,
      });
      setAgents(agents);
      setConnectionStatus('connected');

      await secureStorageService.saveAppState({
        gatewayUrl: activeGatewayUrl,
        gatewayLabel: pairingResult.gatewayLabel ?? gatewayLabel,
        authToken: pairingResult.token,
        selectedAgentId: null,
        selectedSessionId: null,
        isMockMode: activeMockMode,
        continuousMode,
        ttsEnabled,
        captionsEnabled,
      });

      navigation.reset({
        index: 0,
        routes: [{ name: 'AgentSelector' }],
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Pairing failed. Verify the token or check that the Gateway is reachable.';

      setConnectionStatus('error', message);
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer scroll contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Secure pairing</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          Request a pairing token or API key from your OpenClaw Gateway, then store it securely on device.
        </Text>
        <StatusPill status="pairing" />
      </View>

      <Card style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Selected Gateway
        </Text>
        <Text style={[styles.gatewayUrl, { color: theme.colors.text }]}>
          {activeGatewayUrl || 'No Gateway selected'}
        </Text>
        <Text style={[styles.sectionCopy, { color: theme.colors.textMuted }]}>
          Tokens are stored with Expo SecureStore. This app never hardcodes or logs credentials.
        </Text>
      </Card>

      <Card style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Pairing token or API key
        </Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setPairingCode}
          placeholder={activeMockMode ? 'demo-openclaw' : 'Paste pairing token'}
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry={!activeMockMode}
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
              color: theme.colors.text,
            },
          ]}
          value={pairingCode}
        />
        <PrimaryButton
          label={activeMockMode ? 'Pair with mock Gateway' : 'Pair securely'}
          loading={isSubmitting}
          onPress={() => void handlePair()}
        />
        <PrimaryButton
          label="Back to connection options"
          onPress={() => navigation.navigate('GatewayConnect')}
          variant="ghost"
        />
      </Card>

      {activeMockMode ? (
        <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
          Mock mode uses a demo token and simulated agents so you can verify the flow in Expo Go or before a real Gateway is online.
        </Text>
      ) : null}

      {errorMessage ? (
        <View
          style={[
            styles.errorBanner,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.danger,
              borderRadius: theme.radii.md,
            },
          ]}
        >
          <Text style={[styles.errorText, { color: theme.colors.danger }]}>
            {errorMessage}
          </Text>
        </View>
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
    gap: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sectionCopy: {
    fontSize: 14,
    lineHeight: 21,
  },
  gatewayUrl: {
    fontSize: 16,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    fontSize: 16,
    minHeight: 54,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
  },
  errorBanner: {
    borderWidth: 1,
    padding: 14,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 21,
  },
});
