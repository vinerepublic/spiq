import * as SecureStore from 'expo-secure-store';

import { appEnv } from '../config/env';
import type { PersistedAppState } from '../types/app';

const STORAGE_KEY = 'spiq.state';

const defaultState: PersistedAppState = {
  gatewayUrl: appEnv.defaultGatewayUrl,
  gatewayLabel: null,
  authToken: null,
  selectedAgentId: null,
  selectedSessionId: null,
  isMockMode: appEnv.enableMockMode,
  continuousMode: true,
  ttsEnabled: true,
  captionsEnabled: false,
};

class SecureStorageService {
  getDefaultState() {
    return defaultState;
  }

  async loadAppState(): Promise<PersistedAppState> {
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY);

      if (!stored) {
        return defaultState;
      }

      return {
        ...defaultState,
        ...JSON.parse(stored),
      } as PersistedAppState;
    } catch {
      return defaultState;
    }
  }

  async saveAppState(state: PersistedAppState) {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(state));
  }

  async updateAppState(partial: Partial<PersistedAppState>) {
    const current = await this.loadAppState();
    const next = {
      ...current,
      ...partial,
    };

    await this.saveAppState(next);
    return next;
  }

  async clearAppState() {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  }
}

export const secureStorageService = new SecureStorageService();
