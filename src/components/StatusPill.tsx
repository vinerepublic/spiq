import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../hooks/useAppTheme';
import type { GatewayConnectionStatus } from '../types/app';

interface StatusPillProps {
  status: GatewayConnectionStatus;
  label?: string;
}

const statusLabelMap: Record<GatewayConnectionStatus, string> = {
  unconfigured: 'Not synced',
  discovering: 'Detecting Gateway',
  connecting: 'Connecting',
  pairing: 'Pairing',
  connected: 'Connected',
  offline: 'Offline',
  error: 'Error',
};

export const StatusPill = ({ status, label }: StatusPillProps) => {
  const theme = useAppTheme();

  const color =
    status === 'connected'
      ? theme.colors.success
      : status === 'offline' || status === 'error'
        ? theme.colors.danger
        : status === 'discovering' || status === 'pairing' || status === 'connecting'
          ? theme.colors.warning
          : theme.colors.textMuted;

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.pill,
        },
      ]}
    >
      <View
        style={[
          styles.dot,
          {
            backgroundColor: color,
          },
        ]}
      />
      <Text style={[styles.label, { color: theme.colors.text }]}>
        {label ?? statusLabelMap[status]}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
});
