import { useEffect } from 'react';

import { createOpenClawClient } from '../services/openClawClient';
import { useAppStore } from '../store/appStore';

export const useConnectionRecovery = () => {
  const gatewayUrl = useAppStore((state) => state.gatewayUrl);
  const authToken = useAppStore((state) => state.authToken);
  const isMockMode = useAppStore((state) => state.isMockMode);
  const connectionStatus = useAppStore((state) => state.connectionStatus);
  const setConnectionStatus = useAppStore((state) => state.setConnectionStatus);
  const setGatewayContext = useAppStore((state) => state.setGatewayContext);

  useEffect(() => {
    if (!gatewayUrl || isMockMode || connectionStatus !== 'offline') {
      return;
    }

    let active = true;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const reconnect = async () => {
      attempt += 1;

      try {
        const client = createOpenClawClient({
          gatewayUrl,
          authToken,
          isMockMode,
        });
        const health = await client.connectToGateway(gatewayUrl);

        if (!active) {
          return;
        }

        setGatewayContext({
          gatewayLabel: health.gatewayName,
        });
        setConnectionStatus('connected');
      } catch {
        if (!active) {
          return;
        }

        timeout = setTimeout(reconnect, Math.min(15000, 3000 + attempt * 2000));
      }
    };

    timeout = setTimeout(reconnect, 4000);

    return () => {
      active = false;

      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [
    authToken,
    connectionStatus,
    gatewayUrl,
    isMockMode,
    setConnectionStatus,
    setGatewayContext,
  ]);
};
