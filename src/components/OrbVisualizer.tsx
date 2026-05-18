import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { useAppTheme } from '../hooks/useAppTheme';
import type { VoiceInteractionState } from '../types/app';

interface OrbVisualizerProps {
  state: VoiceInteractionState;
  volumeLevel: number;
}

export const OrbVisualizer = ({ state, volumeLevel }: OrbVisualizerProps) => {
  const theme = useAppTheme();
  const pulse = useRef(new Animated.Value(1)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let pulseLoop: Animated.CompositeAnimation | null = null;
    let shimmerLoop: Animated.CompositeAnimation | null = null;

    if (state === 'listening' || state === 'speaking' || state === 'processing') {
      const pulseMax =
        state === 'listening' ? 1.08 : state === 'speaking' ? 1.12 : 1.04;
      const pulseDuration =
        state === 'speaking' ? 720 : state === 'listening' ? 900 : 1200;

      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: pulseMax,
            duration: pulseDuration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: pulseDuration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );

      shimmerLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmer, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(shimmer, {
            toValue: 0,
            duration: 1200,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );

      pulseLoop.start();
      shimmerLoop.start();
    } else {
      Animated.spring(pulse, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
      Animated.spring(shimmer, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      pulseLoop?.stop();
      shimmerLoop?.stop();
    };
  }, [pulse, shimmer, state]);

  const normalizedVolume = Math.min(1, Math.max(0, volumeLevel / 8));
  const ringScale = 1 + normalizedVolume * 0.16;

  const orbColor =
    state === 'listening'
      ? theme.colors.accent
      : state === 'speaking'
        ? theme.colors.warning
        : state === 'processing'
          ? theme.colors.primary
          : theme.colors.primary;

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[
          styles.ring,
          {
            backgroundColor: theme.colors.primarySoft,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.round,
            opacity: shimmer.interpolate({
              inputRange: [0, 1],
              outputRange: [0.22, 0.48],
            }),
            transform: [{ scale: pulse }, { scale: ringScale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.middleRing,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.round,
            opacity: shimmer.interpolate({
              inputRange: [0, 1],
              outputRange: [0.55, 0.82],
            }),
            transform: [{ scale: pulse }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.orb,
          {
            backgroundColor: orbColor,
            borderRadius: theme.radii.round,
            shadowColor: orbColor,
            transform: [{ scale: pulse }],
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    height: 240,
    justifyContent: 'center',
  },
  ring: {
    borderWidth: 1,
    height: 228,
    position: 'absolute',
    width: 228,
  },
  middleRing: {
    borderWidth: 1,
    height: 170,
    position: 'absolute',
    width: 170,
  },
  orb: {
    elevation: 10,
    height: 112,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    width: 112,
  },
});
