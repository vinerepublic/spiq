import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../hooks/useAppTheme';
import type { VoiceInteractionState } from '../types/app';

interface MicButtonProps {
  state: VoiceInteractionState;
  volumeLevel: number;
  onPress: () => void;
}

const stateLabelMap: Record<VoiceInteractionState, string> = {
  idle: 'Tap to Talk',
  listening: 'Stop Listening',
  processing: 'Thinking…',
  speaking: 'Interrupt',
  error: 'Retry Mic',
};

export const MicButton = ({ state, volumeLevel, onPress }: MicButtonProps) => {
  const theme = useAppTheme();
  const normalizedVolume = Math.min(1, Math.max(0, volumeLevel / 8));
  const scale = 1 + normalizedVolume * 0.12;

  const backgroundColor =
    state === 'listening'
      ? theme.colors.accent
      : state === 'speaking'
        ? theme.colors.warning
        : state === 'processing'
          ? theme.colors.primarySoft
          : theme.colors.primary;

  const textColor = state === 'processing' ? theme.colors.text : '#ffffff';

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.round,
            opacity: pressed ? 0.9 : 1,
            transform: [{ scale }],
          },
        ]}
      >
        <Text style={[styles.icon, { color: textColor }]}>●</Text>
      </Pressable>
      <Text style={[styles.label, { color: theme.colors.text }]}>
        {stateLabelMap[state]}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 12,
  },
  button: {
    alignItems: 'center',
    borderWidth: 1,
    height: 120,
    justifyContent: 'center',
    width: 120,
  },
  icon: {
    fontSize: 44,
    lineHeight: 48,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
});
