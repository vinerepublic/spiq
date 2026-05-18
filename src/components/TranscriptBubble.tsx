import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../hooks/useAppTheme';
import type { ConversationMessage } from '../types/app';
import { formatTimestamp } from '../utils/format';

interface TranscriptBubbleProps {
  message: ConversationMessage;
}

export const TranscriptBubble = ({ message }: TranscriptBubbleProps) => {
  const theme = useAppTheme();
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  const backgroundColor = isUser
    ? theme.colors.primary
    : isSystem
      ? theme.colors.surfaceMuted
      : theme.colors.surface;
  const textColor = isUser ? '#ffffff' : theme.colors.text;

  return (
    <View
      style={[
        styles.wrapper,
        {
          alignItems: isUser ? 'flex-end' : 'flex-start',
        },
      ]}
    >
      <View
        style={[
          styles.bubble,
          {
            backgroundColor,
            borderColor: isUser ? theme.colors.primary : theme.colors.border,
            borderRadius: theme.radii.lg,
          },
        ]}
      >
        <Text style={[styles.role, { color: isUser ? '#d8f0ec' : theme.colors.textMuted }]}>
          {isUser ? 'You' : message.role === 'agent' ? 'Agent' : 'System'}
        </Text>
        <Text style={[styles.text, { color: textColor }]}>{message.text}</Text>
        <Text style={[styles.timestamp, { color: isUser ? '#d8f0ec' : theme.colors.textMuted }]}>
          {formatTimestamp(message.createdAt)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  bubble: {
    borderWidth: 1,
    gap: 8,
    maxWidth: '92%',
    minWidth: '40%',
    padding: 16,
  },
  role: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
  },
  timestamp: {
    fontSize: 12,
    fontWeight: '500',
  },
});
