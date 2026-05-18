import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenContainer } from '../components/ScreenContainer';
import { TranscriptBubble } from '../components/TranscriptBubble';
import { useAppTheme } from '../hooks/useAppTheme';
import type { RootStackParamList } from '../navigation/types';
import { createOpenClawClient } from '../services/openClawClient';
import { useAppStore } from '../store/appStore';

type Props = NativeStackScreenProps<RootStackParamList, 'ConversationHistory'>;

export const ConversationHistoryScreen = ({ navigation }: Props) => {
  const theme = useAppTheme();
  const gatewayUrl = useAppStore((state) => state.gatewayUrl);
  const authToken = useAppStore((state) => state.authToken);
  const isMockMode = useAppStore((state) => state.isMockMode);
  const selectedSessionId = useAppStore((state) => state.selectedSessionId);
  const conversationHistory = useAppStore((state) => state.conversationHistory);
  const setConversationHistory = useAppStore((state) => state.setConversationHistory);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messages = selectedSessionId
    ? conversationHistory[selectedSessionId] ?? []
    : [];

  const loadHistory = async () => {
    if (!selectedSessionId) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const client = createOpenClawClient({
        gatewayUrl,
        authToken,
        isMockMode,
      });
      const history = await client.getConversationHistory(selectedSessionId);
      setConversationHistory(selectedSessionId, history);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to refresh conversation history.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSessionId]);

  return (
    <ScreenContainer scroll contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Conversation history
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          Review prior turns from the selected OpenClaw session.
        </Text>
      </View>

      <Card style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Session transcript
          </Text>
          {loading ? <ActivityIndicator color={theme.colors.primary} /> : null}
        </View>
        <PrimaryButton label="Refresh history" onPress={() => void loadHistory()} />
        {messages.length > 0 ? (
          <View style={styles.historyList}>
            {messages.map((message) => (
              <TranscriptBubble key={message.id} message={message} />
            ))}
          </View>
        ) : (
          <Text style={[styles.emptyState, { color: theme.colors.textMuted }]}>
            No history loaded for this session yet.
          </Text>
        )}
      </Card>

      <PrimaryButton label="Back to voice chat" onPress={() => navigation.goBack()} />

      {errorMessage ? (
        <Text style={[styles.errorText, { color: theme.colors.danger }]}>
          {errorMessage}
        </Text>
      ) : null}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 18,
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  section: {
    gap: 14,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  historyList: {
    gap: 12,
  },
  emptyState: {
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
