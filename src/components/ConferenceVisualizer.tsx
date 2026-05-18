import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { OrbVisualizer } from './OrbVisualizer';
import { ParticipantIndicator } from './ParticipantIndicator';
import type { ConferenceParticipant, VoiceInteractionState } from '../types/app';

interface ConferenceVisualizerProps {
  participants: ConferenceParticipant[];
  activeSpeakerId: string | null;
  voiceState: VoiceInteractionState;
  volumeLevel: number;
}

export const ConferenceVisualizer = ({
  participants,
  activeSpeakerId,
  voiceState,
  volumeLevel,
}: ConferenceVisualizerProps) => {
  // Filter to only show agent participants (not the user)
  const agentParticipants = useMemo(
    () => participants.filter((p) => p.type === 'agent' && p.status !== 'left'),
    [participants],
  );

  // Calculate positions for participants around the orb
  const participantPositions = useMemo(() => {
    const count = agentParticipants.length;
    if (count === 0) return [];

    const radius = 130; // Distance from center
    const angleStep = (2 * Math.PI) / Math.max(count, 1);
    const startAngle = -Math.PI / 2; // Start from top

    return agentParticipants.map((participant, index) => {
      const angle = startAngle + angleStep * index;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      return {
        participant,
        x,
        y,
        isActive: participant.identity === activeSpeakerId,
      };
    });
  }, [agentParticipants, activeSpeakerId]);

  return (
    <View style={styles.wrapper}>
      {/* Central orb */}
      <OrbVisualizer state={voiceState} volumeLevel={volumeLevel} />

      {/* Participant indicators positioned around the orb */}
      {participantPositions.map(({ participant, x, y, isActive }) => (
        <ParticipantIndicator
          key={participant.id}
          participant={participant}
          isActive={isActive}
          style={{
            transform: [{ translateX: x }, { translateY: y }],
          }}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    height: 340,
    justifyContent: 'center',
    width: '100%',
  },
});
