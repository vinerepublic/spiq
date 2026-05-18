import { useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { RectButton } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/Swipeable';

import { useAppTheme } from '../hooks/useAppTheme';
import type { AgentSummary } from '../types/app';

interface SwipeableAgentCardProps {
  agent: AgentSummary;
  isSelected: boolean;
  onSwipeAdd: () => void;
  onSwipeRemove: () => void;
}

export const SwipeableAgentCard = ({
  agent,
  isSelected,
  onSwipeAdd,
  onSwipeRemove,
}: SwipeableAgentCardProps) => {
  const theme = useAppTheme();
  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    _dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const translateX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [100, 0],
    });

    return (
      <Animated.View
        style={[
          styles.actionContainer,
          { transform: [{ translateX }] },
        ]}
      >
        <RectButton
          style={[
            styles.actionButton,
            { backgroundColor: theme.colors.danger },
          ]}
          onPress={() => {
            onSwipeRemove();
            swipeableRef.current?.close();
          }}
        >
          <Text style={styles.actionText}>Remove</Text>
        </RectButton>
      </Animated.View>
    );
  };

  const renderLeftActions = (
    progress: Animated.AnimatedInterpolation<number>,
    _dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const translateX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [-100, 0],
    });

    return (
      <Animated.View
        style={[
          styles.actionContainer,
          { transform: [{ translateX }] },
        ]}
      >
        <RectButton
          style={[
            styles.actionButton,
            { backgroundColor: theme.colors.success },
          ]}
          onPress={() => {
            onSwipeAdd();
            swipeableRef.current?.close();
          }}
        >
          <Text style={styles.actionText}>Add</Text>
        </RectButton>
      </Animated.View>
    );
  };

  const handleSwipeableOpen = (direction: 'left' | 'right') => {
    if (direction === 'left') {
      // Swiped right (revealed left action) = Add
      onSwipeAdd();
    } else {
      // Swiped left (revealed right action) = Remove
      onSwipeRemove();
    }
    // Auto-close after action
    setTimeout(() => {
      swipeableRef.current?.close();
    }, 300);
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={!isSelected ? renderLeftActions : undefined}
      renderRightActions={isSelected ? renderRightActions : undefined}
      onSwipeableOpen={handleSwipeableOpen}
      friction={2}
      overshootLeft={false}
      overshootRight={false}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: isSelected
              ? theme.colors.primarySoft
              : theme.colors.surfaceMuted,
            borderColor: isSelected
              ? theme.colors.primary
              : theme.colors.border,
            borderRadius: theme.radii.md,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.agentInfo}>
            {isSelected && (
              <View
                style={[
                  styles.checkBadge,
                  { backgroundColor: theme.colors.primary },
                ]}
              >
                <Text style={styles.checkMark}>✓</Text>
              </View>
            )}
            <Text style={[styles.agentName, { color: theme.colors.text }]}>
              {agent.name}
            </Text>
          </View>
          <Text
            style={[
              styles.agentStatus,
              {
                color:
                  agent.status === 'available'
                    ? theme.colors.success
                    : agent.status === 'busy'
                      ? theme.colors.warning
                      : theme.colors.danger,
              },
            ]}
          >
            {agent.status}
          </Text>
        </View>
        <Text style={[styles.agentDescription, { color: theme.colors.textMuted }]}>
          {agent.description}
        </Text>
        <Text style={[styles.agentCaps, { color: theme.colors.textMuted }]}>
          {agent.capabilities.join(' • ')}
        </Text>
        {!isSelected && (
          <Text style={[styles.swipeHint, { color: theme.colors.textMuted }]}>
            Swipe right to add →
          </Text>
        )}
      </View>
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  agentInfo: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  checkBadge: {
    alignItems: 'center',
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkMark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  agentName: {
    fontSize: 17,
    fontWeight: '800',
  },
  agentStatus: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  agentDescription: {
    fontSize: 14,
    lineHeight: 21,
  },
  agentCaps: {
    fontSize: 13,
    fontWeight: '600',
  },
  swipeHint: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  actionContainer: {
    justifyContent: 'center',
    width: 100,
  },
  actionButton: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
