import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  interpolateColor,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';

import { useAppTheme } from '../hooks/useAppTheme';
import { Card } from './Card';
import { PrimaryButton } from './PrimaryButton';
import type { AgentSummary } from '../types/app';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = screenWidth - 40; // Account for padding
const SWIPE_THRESHOLD = 0.25; // 25% of card width
const ROTATION_DEGREE = 10; // Max rotation in degrees

interface SwipeAgentSelectorProps {
  agents: AgentSummary[];
  selectedAgents: AgentSummary[];
  loading?: boolean;
  onAgentSelect: (agent: AgentSummary) => void;
  onAgentDeselect: (agent: AgentSummary) => void;
  onStartInstantChat: (agent: AgentSummary) => void;
  onStartGroupChat: (agents: AgentSummary[]) => void;
}

interface SwipeableCardProps {
  agent: AgentSummary;
  index: number;
  isSelected: boolean;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onTap: () => void;
}

const SwipeableCard = ({
  agent,
  index,
  isSelected,
  onSwipeRight,
  onSwipeLeft,
  onTap,
}: SwipeableCardProps) => {
  const theme = useAppTheme();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const isActive = useSharedValue(false);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      isActive.value = true;
      scale.value = withSpring(1.05);
      runOnJS(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))();
    })
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.1; // Reduced vertical movement
    })
    .onEnd((event) => {
      const shouldSwipeRight = event.translationX > CARD_WIDTH * SWIPE_THRESHOLD;
      const shouldSwipeLeft = event.translationX < -CARD_WIDTH * SWIPE_THRESHOLD;

      if (shouldSwipeRight) {
        // Swipe right - add agent
        translateX.value = withTiming(CARD_WIDTH + 50, { duration: 300 });
        scale.value = withTiming(0.8, { duration: 300 });
        runOnJS(() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onSwipeRight();
        })();
      } else if (shouldSwipeLeft) {
        // Swipe left - remove agent
        translateX.value = withTiming(-CARD_WIDTH - 50, { duration: 300 });
        scale.value = withTiming(0.8, { duration: 300 });
        runOnJS(() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          onSwipeLeft();
        })();
      } else {
        // Spring back to center
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
      
      isActive.value = false;
      if (!shouldSwipeRight && !shouldSwipeLeft) {
        scale.value = withSpring(1);
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    const rotateZ = interpolate(
      translateX.value,
      [-CARD_WIDTH, 0, CARD_WIDTH],
      [-ROTATION_DEGREE, 0, ROTATION_DEGREE]
    );

    const opacity = interpolate(
      Math.abs(translateX.value),
      [0, CARD_WIDTH * 0.5, CARD_WIDTH],
      [1, 0.8, 0.5]
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
        { rotateZ: `${rotateZ}deg` },
      ],
      opacity,
      zIndex: 1000 - index,
    };
  });

  const rightOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [0, CARD_WIDTH * SWIPE_THRESHOLD],
      [0, 1]
    );

    const backgroundColor = interpolateColor(
      translateX.value,
      [0, CARD_WIDTH * SWIPE_THRESHOLD],
      ['rgba(35, 133, 106, 0)', 'rgba(35, 133, 106, 0.8)'] // Success color
    );

    return {
      opacity: translateX.value > 0 ? opacity : 0,
      backgroundColor,
    };
  });

  const leftOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [-CARD_WIDTH * SWIPE_THRESHOLD, 0],
      [1, 0]
    );

    const backgroundColor = interpolateColor(
      translateX.value,
      [-CARD_WIDTH * SWIPE_THRESHOLD, 0],
      ['rgba(207, 74, 74, 0.8)', 'rgba(207, 74, 74, 0)'] // Danger color
    );

    return {
      opacity: translateX.value < 0 ? opacity : 0,
      backgroundColor,
    };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.swipeableContainer, animatedStyle]}>
        <Pressable onPress={onTap} style={styles.cardPressable}>
          <Card style={[
            styles.agentCard,
            {
              borderColor: isSelected
                ? theme.colors.primary
                : theme.colors.border,
              backgroundColor: isSelected
                ? theme.colors.primarySoft
                : theme.colors.surface,
            }
          ]}>
            <View style={styles.agentHeader}>
              <View style={styles.agentInfo}>
                <Text style={[styles.agentName, { color: theme.colors.text }]}>
                  {agent.name}
                </Text>
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
            </View>
            <Text style={[styles.agentDescription, { color: theme.colors.textMuted }]}>
              {agent.description}
            </Text>
            <Text style={[styles.agentCaps, { color: theme.colors.textMuted }]}>
              {agent.capabilities.join(' • ')}
            </Text>
          </Card>

          {/* Right swipe overlay (Add) */}
          <Animated.View style={[styles.swipeOverlay, rightOverlayStyle]}>
            <View style={styles.swipeIndicator}>
              <Text style={styles.swipeText}>➕ ADD TO TEAM</Text>
            </View>
          </Animated.View>
          
          {/* Left swipe overlay (Remove) */}
          <Animated.View style={[styles.swipeOverlay, leftOverlayStyle]}>
            <View style={styles.swipeIndicator}>
              <Text style={styles.swipeText}>➖ REMOVE</Text>
            </View>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
};

export const SwipeAgentSelector = ({
  agents,
  selectedAgents,
  loading = false,
  onAgentSelect,
  onAgentDeselect,
  onStartInstantChat,
  onStartGroupChat,
}: SwipeAgentSelectorProps) => {
  const theme = useAppTheme();
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentAgent = agents[currentIndex];
  const isSelected = selectedAgents.some(agent => agent.id === currentAgent?.id);
  const hasMoreAgents = currentIndex < agents.length - 1;
  const canStartGroup = selectedAgents.length >= 2;

  const handleSwipeRight = useCallback(() => {
    if (currentAgent && !isSelected) {
      onAgentSelect(currentAgent);
    }
    if (hasMoreAgents) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentAgent, isSelected, hasMoreAgents, onAgentSelect]);

  const handleSwipeLeft = useCallback(() => {
    if (currentAgent && isSelected) {
      onAgentDeselect(currentAgent);
    }
    if (hasMoreAgents) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentAgent, isSelected, hasMoreAgents, onAgentDeselect]);

  const handleTap = useCallback(() => {
    if (currentAgent) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onStartInstantChat(currentAgent);
    }
  }, [currentAgent, onStartInstantChat]);

  const handleStartGroup = useCallback(() => {
    if (canStartGroup) {
      onStartGroupChat(selectedAgents);
    }
  }, [canStartGroup, selectedAgents, onStartGroupChat]);

  const handleReset = useCallback(() => {
    setCurrentIndex(0);
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.textMuted }]}>
          Loading agents...
        </Text>
      </View>
    );
  }

  if (agents.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
          No agents available
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Swipe instructions */}
      <View style={styles.instructionsContainer}>
        <Text style={[styles.instructionsTitle, { color: theme.colors.text }]}>
          Build Your AI Team
        </Text>
        <Text style={[styles.instructionsText, { color: theme.colors.textMuted }]}>
          👆 Tap for instant 1-on-1 • 👉 Swipe right to add • 👈 Swipe left to remove
        </Text>
      </View>

      {/* Agent cards stack */}
      <View style={styles.cardsContainer}>
        {currentIndex >= agents.length ? (
          <View style={styles.completedContainer}>
            <Text style={[styles.completedText, { color: theme.colors.text }]}>
              🎉 All agents reviewed!
            </Text>
            <PrimaryButton
              label="Review again"
              onPress={handleReset}
              variant="secondary"
            />
          </View>
        ) : (
          agents
            .slice(currentIndex, currentIndex + 3) // Show current + 2 behind
            .map((agent, relativeIndex) => (
              <SwipeableCard
                key={agent.id}
                agent={agent}
                index={relativeIndex}
                isSelected={selectedAgents.some(selected => selected.id === agent.id)}
                onSwipeRight={relativeIndex === 0 ? handleSwipeRight : () => {}}
                onSwipeLeft={relativeIndex === 0 ? handleSwipeLeft : () => {}}
                onTap={relativeIndex === 0 ? handleTap : () => {}}
              />
            ))
        )}
      </View>

      {/* Progress indicator */}
      <View style={styles.progressContainer}>
        <Text style={[styles.progressText, { color: theme.colors.textMuted }]}>
          {Math.min(currentIndex + 1, agents.length)} of {agents.length}
        </Text>
      </View>

      {/* Selected agents queue */}
      {selectedAgents.length > 0 && (
        <View style={styles.selectedContainer}>
          <Text style={[styles.selectedTitle, { color: theme.colors.text }]}>
            Your Team ({selectedAgents.length})
          </Text>
          <View style={styles.selectedAgentsRow}>
            {selectedAgents.map((agent) => (
              <View
                key={agent.id}
                style={[
                  styles.selectedAgentChip,
                  {
                    backgroundColor: theme.colors.primarySoft,
                    borderColor: theme.colors.primary,
                  }
                ]}
              >
                <Text style={[styles.selectedAgentName, { color: theme.colors.text }]}>
                  {agent.name}
                </Text>
                <Pressable
                  onPress={() => onAgentDeselect(agent)}
                  style={styles.removeButton}
                >
                  <Text style={styles.removeButtonText}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
          <PrimaryButton
            label={`Start Chat with ${selectedAgents.length} agent${selectedAgents.length === 1 ? '' : 's'}`}
            onPress={handleStartGroup}
            disabled={!canStartGroup}
          />
          {!canStartGroup && selectedAgents.length === 1 && (
            <Text style={[styles.groupHint, { color: theme.colors.textMuted }]}>
              Add at least one more agent to start a group chat
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
  instructionsContainer: {
    alignItems: 'center',
    gap: 8,
  },
  instructionsTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  instructionsText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  cardsContainer: {
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  swipeableContainer: {
    position: 'absolute',
    width: CARD_WIDTH,
  },
  cardPressable: {
    position: 'relative',
  },
  agentCard: {
    width: CARD_WIDTH,
    gap: 12,
  },
  agentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  agentInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  agentName: {
    fontSize: 18,
    fontWeight: '800',
  },
  agentStatus: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  agentDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  agentCaps: {
    fontSize: 13,
    fontWeight: '600',
  },
  swipeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeIndicator: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  swipeText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
    textAlign: 'center',
  },
  completedContainer: {
    alignItems: 'center',
    gap: 16,
  },
  completedText: {
    fontSize: 18,
    fontWeight: '600',
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectedContainer: {
    gap: 16,
  },
  selectedTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  selectedAgentsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  selectedAgentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  selectedAgentName: {
    fontSize: 14,
    fontWeight: '600',
  },
  removeButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
  },
  groupHint: {
    fontSize: 13,
    textAlign: 'center',
  },
});