import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { useAppTheme } from '../hooks/useAppTheme';
import type { ConferenceParticipant } from '../types/app';

interface ParticipantIndicatorProps {
  participant: ConferenceParticipant;
  isActive: boolean;
  style?: ViewStyle;
}

export const ParticipantIndicator = ({
  participant,
  isActive,
  style,
}: ParticipantIndicatorProps) => {
  const theme = useAppTheme();
  const pulse = useRef(new Animated.Value(1)).current;
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let pulseLoop: Animated.CompositeAnimation | null = null;

    if (isActive || participant.status === 'speaking') {
      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );

      Animated.spring(ring, {
        toValue: 1,
        useNativeDriver: true,
      }).start();

      pulseLoop.start();
    } else {
      Animated.spring(pulse, {
        toValue: 1,
        useNativeDriver: true,
      }).start();

      Animated.spring(ring, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      pulseLoop?.stop();
    };
  }, [isActive, participant.status, pulse, ring]);

  const initial = participant.name.charAt(0).toUpperCase();
  const avatarColor =
    participant.status === 'speaking' || isActive
      ? theme.colors.accent
      : participant.status === 'left'
        ? theme.colors.textMuted
        : theme.colors.primary;

  return (
    <View style={[styles.container, style]}>
      {/* Animated ring for active speaker */}
      <Animated.View
        style={[
          styles.ring,
          {
            backgroundColor: theme.colors.primarySoft,
            borderRadius: theme.radii.round,
            opacity: ring.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.5],
            }),
            transform: [
              {
                scale: ring.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.3],
                }),
              },
            ],
          },
        ]}
      />

      {/* Avatar circle */}
      <Animated.View
        style={[
          styles.avatar,
          {
            backgroundColor: avatarColor,
            borderRadius: theme.radii.round,
            borderColor: isActive ? theme.colors.accent : theme.colors.border,
            borderWidth: isActive ? 2 : 1,
            transform: [{ scale: pulse }],
          },
        ]}
      >
        <Text style={[styles.initial, { color: theme.colors.surface }]}>
          {initial}
        </Text>
      </Animated.View>

      {/* Name label */}
      <Text
        style={[styles.name, { color: theme.colors.text }]}
        numberOfLines={1}
      >
        {participant.name}
      </Text>

      {/* Muted indicator */}
      {participant.isMuted && (
        <View
          style={[
            styles.mutedBadge,
            { backgroundColor: theme.colors.danger },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    position: 'absolute',
  },
  ring: {
    height: 60,
    position: 'absolute',
    width: 60,
  },
  avatar: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  initial: {
    fontSize: 20,
    fontWeight: '700',
  },
  name: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    maxWidth: 70,
    textAlign: 'center',
  },
  mutedBadge: {
    borderRadius: 4,
    height: 8,
    position: 'absolute',
    right: -2,
    top: 0,
    width: 8,
  },
});
