import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenContainer } from '../components/ScreenContainer';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAppStore } from '../store/appStore';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const featureCopy = [
  'Detect and sync with your OpenClaw Gateway on your local network.',
  'Pair securely with your existing agent sessions and credentials.',
  'Speak naturally, hear spoken replies, and stay in flow with minimal tapping.',
];

export const OnboardingScreen = ({ navigation }: Props) => {
  const theme = useAppTheme();
  const isMockMode = useAppStore((state) => state.isMockMode);

  return (
    <ScreenContainer scroll contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>
          Spiq
        </Text>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Connect to your OpenClaw Gateway.
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          A privacy-first mobile voice wrapper for your self-hosted OpenClaw agents.
        </Text>
      </View>

      <Card style={styles.card}>
        {featureCopy.map((item) => (
          <View key={item} style={styles.featureRow}>
            <Text style={[styles.featureBullet, { color: theme.colors.primary }]}>•</Text>
            <Text style={[styles.featureText, { color: theme.colors.text }]}>{item}</Text>
          </View>
        ))}
      </Card>

      <View style={styles.actions}>
        <PrimaryButton
          label="Connect to Gateway"
          onPress={() => navigation.navigate('GatewayConnect')}
        />
        {isMockMode ? (
          <Text style={[styles.footnote, { color: theme.colors.textMuted }]}>
            Mock mode is enabled, so you can test the full flow without a live Gateway.
          </Text>
        ) : null}
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 24,
    justifyContent: 'center',
  },
  hero: {
    gap: 14,
    marginTop: 40,
  },
  eyebrow: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 28,
  },
  card: {
    gap: 18,
  },
  featureRow: {
    flexDirection: 'row',
    gap: 12,
  },
  featureBullet: {
    fontSize: 18,
    fontWeight: '800',
  },
  featureText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
  },
  actions: {
    gap: 14,
  },
  footnote: {
    fontSize: 14,
    lineHeight: 20,
  },
});
