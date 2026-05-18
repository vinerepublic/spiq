import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraView, type BarcodeScanningResult, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
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
import { gatewayDiscoveryService } from '../services/gatewayDiscoveryService';
import { createOpenClawClient } from '../services/openClawClient';
import { secureStorageService } from '../services/secureStorageService';
import { useAppStore } from '../store/appStore';
import type { GatewayCandidate } from '../types/app';
import type { RootStackParamList } from '../navigation/types';
import { normalizeGatewayUrl } from '../utils/gateway';

type Props = NativeStackScreenProps<RootStackParamList, 'GatewayConnect'>;

export const GatewayConnectScreen = ({ navigation }: Props) => {
  const theme = useAppTheme();
  const gatewayUrl = useAppStore((state) => state.gatewayUrl);
  const discoveredGateways = useAppStore((state) => state.discoveredGateways);
  const connectionStatus = useAppStore((state) => state.connectionStatus);
  const setConnectionStatus = useAppStore((state) => state.setConnectionStatus);
  const setDiscoveredGateways = useAppStore((state) => state.setDiscoveredGateways);
  const setGatewayContext = useAppStore((state) => state.setGatewayContext);
  const [manualUrl, setManualUrl] = useState(gatewayUrl);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const persistGatewayDraft = async (
    candidate: GatewayCandidate,
    gatewayLabel: string | null,
  ) => {
    await secureStorageService.updateAppState({
      gatewayUrl: candidate.url,
      gatewayLabel,
      authToken: null,
      selectedAgentId: null,
      selectedSessionId: null,
      isMockMode: Boolean(candidate.isMock),
    });
  };

  const connectToCandidate = async (candidate: GatewayCandidate) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setConnectionStatus('connecting');

    try {
      const client = createOpenClawClient({
        gatewayUrl: candidate.url,
        isMockMode: candidate.isMock,
      });
      const health = await client.connectToGateway(candidate.url);

      setGatewayContext({
        gatewayUrl: candidate.url,
        gatewayLabel: health.gatewayName ?? candidate.name,
        authToken: null,
        isMockMode: Boolean(candidate.isMock),
        connectionMethod:
          candidate.source === 'lan-scan' || candidate.source === 'mdns'
            ? 'auto'
            : candidate.source === 'qr'
              ? 'qr'
              : candidate.isMock
                ? 'mock'
                : 'manual',
      });
      setConnectionStatus('pairing');
      await persistGatewayDraft(candidate, health.gatewayName ?? candidate.name);

      navigation.navigate('Pairing', {
        gatewayUrl: candidate.url,
        pairingCode: candidate.pairingToken,
        isMockMode: candidate.isMock,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to reach that OpenClaw Gateway.';

      setConnectionStatus('error', message);
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDiscover = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setConnectionStatus('discovering');

    try {
      const gateways = await gatewayDiscoveryService.discoverCandidates();
      setDiscoveredGateways(gateways);

      if (gateways.length === 0) {
        const message =
          'No OpenClaw Gateway was detected. Enter a URL manually or use QR pairing.';

        setConnectionStatus('error', message);
        setErrorMessage(message);
      } else {
        setConnectionStatus('unconfigured');
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Gateway discovery failed. Try manual URL entry.';

      setConnectionStatus('error', message);
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualConnect = async () => {
    const normalized = normalizeGatewayUrl(manualUrl);

    if (!normalized) {
      setErrorMessage('Enter a valid Gateway URL before continuing.');
      return;
    }

    await connectToCandidate({
      id: normalized,
      name: 'OpenClaw Gateway',
      url: normalized,
      source: 'manual',
    });
  };

  const handleQrPress = async () => {
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();

      if (!permission.granted) {
        Alert.alert(
          'Camera permission required',
          'QR pairing needs camera access to scan an OpenClaw Gateway pairing code.',
        );
        return;
      }
    }

    setIsScanning(true);
  };

  const handleQrScanned = async (result: BarcodeScanningResult) => {
    setIsScanning(false);
    const candidate = gatewayDiscoveryService.parsePairingQr(result.data);

    if (!candidate) {
      setErrorMessage('QR code was scanned, but it did not contain a valid Gateway URL.');
      return;
    }

    await connectToCandidate(candidate);
  };

  const handleMockMode = async () => {
    const candidate = gatewayDiscoveryService.parsePairingQr('mock://openclaw-gateway');

    if (!candidate) {
      return;
    }

    await connectToCandidate(candidate);
  };

  return (
    <ScreenContainer scroll contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Detect and sync with OpenClaw
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          Auto-detect your Gateway on the local network, enter the URL manually, or pair with a QR code.
        </Text>
        <StatusPill status={connectionStatus} />
      </View>

      <Card style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Auto-detect on local network
        </Text>
        <Text style={[styles.sectionCopy, { color: theme.colors.textMuted }]}>
          Scans common OpenClaw hostnames and ports, then falls back to mock mode if enabled.
        </Text>
        <PrimaryButton
          label="Scan for Gateway"
          loading={isSubmitting && connectionStatus === 'discovering'}
          onPress={() => void handleDiscover()}
        />
        {discoveredGateways.length > 0 ? (
          <View style={styles.gatewayList}>
            {discoveredGateways.map((candidate) => (
              <Pressable
                key={candidate.id}
                onPress={() => void connectToCandidate(candidate)}
                style={[
                  styles.gatewayRow,
                  {
                    backgroundColor: theme.colors.surfaceMuted,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radii.md,
                  },
                ]}
              >
                <View style={styles.gatewayMeta}>
                  <Text style={[styles.gatewayName, { color: theme.colors.text }]}>
                    {candidate.name}
                  </Text>
                  <Text style={[styles.gatewayUrl, { color: theme.colors.textMuted }]}>
                    {candidate.url}
                  </Text>
                </View>
                <Text style={[styles.gatewaySource, { color: theme.colors.primary }]}>
                  {candidate.source}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Card>

      <Card style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Manual Gateway URL
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
        <PrimaryButton
          label="Connect via URL"
          loading={isSubmitting && connectionStatus === 'connecting'}
          onPress={() => void handleManualConnect()}
        />
      </Card>

      <Card style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          QR code pairing
        </Text>
        {isScanning ? (
          <View
            style={[
              styles.cameraContainer,
              {
                borderColor: theme.colors.border,
                borderRadius: theme.radii.lg,
              },
            ]}
          >
            <CameraView
              barcodeScannerSettings={{
                barcodeTypes: ['qr'],
              }}
              onBarcodeScanned={(result) => void handleQrScanned(result)}
              style={StyleSheet.absoluteFill}
            />
            <Pressable onPress={() => setIsScanning(false)} style={styles.closeScanner}>
              <Text style={[styles.closeScannerText, { color: '#ffffff' }]}>Close</Text>
            </Pressable>
          </View>
        ) : (
          <PrimaryButton label="Scan pairing QR code" onPress={() => void handleQrPress()} />
        )}
      </Card>

      {appEnv.enableMockMode ? (
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Mock mode
          </Text>
          <Text style={[styles.sectionCopy, { color: theme.colors.textMuted }]}>
            Run the entire app flow with a simulated OpenClaw Gateway, agents, sessions, and replies.
          </Text>
          <PrimaryButton label="Use mock Gateway" onPress={() => void handleMockMode()} />
        </Card>
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

      {isSubmitting && connectionStatus === 'connecting' ? (
        <View style={styles.loaderRow}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={[styles.loaderText, { color: theme.colors.textMuted }]}>
            Connecting to Gateway…
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
    lineHeight: 34,
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
  gatewayList: {
    gap: 10,
  },
  gatewayRow: {
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
    padding: 14,
  },
  gatewayMeta: {
    flex: 1,
    gap: 4,
  },
  gatewayName: {
    fontSize: 16,
    fontWeight: '700',
  },
  gatewayUrl: {
    fontSize: 13,
  },
  gatewaySource: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    fontSize: 16,
    minHeight: 54,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cameraContainer: {
    height: 260,
    overflow: 'hidden',
    position: 'relative',
  },
  closeScanner: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 999,
    margin: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  closeScannerText: {
    fontSize: 14,
    fontWeight: '700',
  },
  errorBanner: {
    borderWidth: 1,
    padding: 14,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 21,
  },
  loaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  loaderText: {
    fontSize: 14,
  },
});
