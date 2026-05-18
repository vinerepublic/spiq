import * as Network from 'expo-network';

import { appEnv } from '../config/env';
import type { GatewayCandidate, GatewayHealth } from '../types/app';
import {
  buildGatewayUrl,
  createId,
  fetchWithTimeout,
  normalizeGatewayUrl,
} from '../utils/gateway';

const COMMON_PORTS = [3333, 3000, 8080, 8787];
const COMMON_HOSTS = ['openclaw.local', 'gateway.local', 'localhost', '127.0.0.1'];

const createMockCandidate = (): GatewayCandidate => ({
  id: 'mock-openclaw-gateway',
  name: 'OpenClaw Mock Gateway',
  url: 'mock://openclaw-gateway',
  source: 'mock',
  isMock: true,
  health: {
    status: 'ok',
    gatewayName: 'OpenClaw Mock Gateway',
    version: 'mock-1.0',
  },
});

const buildLanCandidates = (deviceIp: string) => {
  if (!deviceIp || deviceIp === '0.0.0.0') {
    return [];
  }

  const segments = deviceIp.split('.');
  if (segments.length !== 4) {
    return [];
  }

  const subnet = segments.slice(0, 3).join('.');
  const likelyHosts = [1, 2, 10, 20, 100, 200];

  return likelyHosts.flatMap((host) =>
    COMMON_PORTS.map((port) => `http://${subnet}.${host}:${port}`),
  );
};

const probeGateway = async (
  url: string,
  source: GatewayCandidate['source'],
): Promise<GatewayCandidate | null> => {
  const startedAt = Date.now();

  try {
    const response = await fetchWithTimeout(buildGatewayUrl(url, '/health'), {}, 2000);

    if (!response.ok) {
      return null;
    }

    const health = (await response.json()) as GatewayHealth;

    return {
      id: createId('gateway'),
      name: health.gatewayName ?? 'OpenClaw Gateway',
      url: normalizeGatewayUrl(url),
      source,
      latencyMs: Date.now() - startedAt,
      health,
    };
  } catch {
    return null;
  }
};

class GatewayDiscoveryService {
  async discoverCandidates() {
    const networkState = await Network.getNetworkStateAsync();
    const deviceIp = await Network.getIpAddressAsync().catch(() => '0.0.0.0');

    const candidates = new Set<string>();

    if (appEnv.defaultGatewayUrl) {
      candidates.add(normalizeGatewayUrl(appEnv.defaultGatewayUrl));
    }

    COMMON_HOSTS.forEach((host) => {
      COMMON_PORTS.forEach((port) => {
        candidates.add(`http://${host}:${port}`);
      });
    });

    if (networkState.isConnected) {
      buildLanCandidates(deviceIp).forEach((candidate) => candidates.add(candidate));
    }

    const probeResults = await Promise.all(
      [...candidates].map((candidate) => probeGateway(candidate, 'lan-scan')),
    );

    const discovered = probeResults.filter(
      (candidate): candidate is GatewayCandidate => candidate !== null,
    );

    if (discovered.length > 0) {
      return discovered;
    }

    // TODO: Replace this placeholder fallback with real mDNS/Bonjour discovery once
    // the OpenClaw Gateway advertises a stable service name on the local network.
    return appEnv.enableMockMode ? [createMockCandidate()] : [];
  }

  parsePairingQr(rawValue: string) {
    const value = rawValue.trim();

    if (!value) {
      return null;
    }

    try {
      const parsed = JSON.parse(value) as {
        gatewayUrl?: string;
        token?: string;
        pairingToken?: string;
        name?: string;
      };

      if (!parsed.gatewayUrl) {
        return null;
      }

      return {
        id: createId('gateway'),
        name: parsed.name ?? 'OpenClaw Gateway',
        url: normalizeGatewayUrl(parsed.gatewayUrl),
        source: 'qr' as const,
        pairingToken: parsed.pairingToken ?? parsed.token,
      };
    } catch {
      if (value.startsWith('mock://')) {
        return createMockCandidate();
      }

      const normalized = normalizeGatewayUrl(value);
      if (!normalized) {
        return null;
      }

      return {
        id: createId('gateway'),
        name: 'OpenClaw Gateway',
        url: normalized,
        source: 'qr' as const,
      };
    }
  }
}

export const gatewayDiscoveryService = new GatewayDiscoveryService();
