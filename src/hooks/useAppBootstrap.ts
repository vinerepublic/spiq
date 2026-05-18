import { useEffect } from 'react';

import { createOpenClawClient } from '../services/openClawClient';
import { secureStorageService } from '../services/secureStorageService';
import { useAppStore } from '../store/appStore';

export const useAppBootstrap = () => {
  const applyPersistedState = useAppStore((state) => state.applyPersistedState);
  const setConnectionStatus = useAppStore((state) => state.setConnectionStatus);
  const setGatewayContext = useAppStore((state) => state.setGatewayContext);
  const setHydrated = useAppStore((state) => state.setHydrated);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      const persistedState = await secureStorageService.loadAppState();

      if (!active) {
        return;
      }

      applyPersistedState(persistedState);

      if (persistedState.gatewayUrl) {
        const client = createOpenClawClient({
          gatewayUrl: persistedState.gatewayUrl,
          authToken: persistedState.authToken,
          isMockMode: persistedState.isMockMode,
        });

        try {
          setConnectionStatus('connecting');
          const health = await client.connectToGateway(persistedState.gatewayUrl);

          if (!active) {
            return;
          }

          setGatewayContext({
            gatewayLabel: health.gatewayName ?? persistedState.gatewayLabel,
          });
          setConnectionStatus('connected');
        } catch {
          if (!active) {
            return;
          }

          setConnectionStatus(
            'offline',
            'Saved Gateway is currently unreachable. You can retry or switch to mock mode.',
          );
        }
      }

      if (active) {
        setHydrated(true);
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, [applyPersistedState, setConnectionStatus, setGatewayContext, setHydrated]);
};
