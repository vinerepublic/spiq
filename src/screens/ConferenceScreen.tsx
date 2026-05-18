import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ConferenceVisualizer } from '../components/ConferenceVisualizer';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenContainer } from '../components/ScreenContainer';
import { StatusPill } from '../components/StatusPill';
import { useAppTheme } from '../hooks/useAppTheme';
import type { RootStackParamList } from '../navigation/types';
import { createConferenceVoiceSessionService } from '../services/conferenceVoiceSessionService';
import { createOpenClawClient } from '../services/openClawClient';
import { useAppStore } from '../store/appStore';
import type { ConferenceParticipant, ConversationMessage } from '../types/app';
import type {
  LiveVoiceConnectionState,
  LiveVoiceTranscriptEvent,
  OpenClawConferenceSession,
} from '../types/realtime';
import { createId } from '../utils/gateway';

type Props = NativeStackScreenProps<RootStackParamList, 'Conference'>;

export const ConferenceScreen = ({ navigation }: Props) => {
  const theme = useAppTheme();
  const gatewayUrl = useAppStore((state) => state.gatewayUrl);
  const gatewayLabel = useAppStore((state) => state.gatewayLabel);
  const authToken = useAppStore((state) => state.authToken);
  const isMockMode = useAppStore((state) => state.isMockMode);
  const connectionStatus = useAppStore((state) => state.connectionStatus);
  const agents = useAppStore((state) => state.agents);
  const invitedAgentIds = useAppStore((state) => state.invitedAgentIds);
  const selectedSessionId = useAppStore((state) => state.selectedSessionId);
  const conversationHistory = useAppStore((state) => state.conversationHistory);
  const voiceState = useAppStore((state) => state.voiceState);
  const liveTranscript = useAppStore((state) => state.liveTranscript);
  const partialTranscript = useAppStore((state) => state.partialTranscript);
  const captionsEnabled = useAppStore((state) => state.captionsEnabled);
  const volumeLevel = useAppStore((state) => state.volumeLevel);
  const conferenceParticipants = useAppStore(
    (state) => state.conferenceParticipants,
  );
  const activeSpeakerId = useAppStore((state) => state.activeSpeakerId);
  const activeSpeakerAgentId = useAppStore((state) => state.activeSpeakerAgentId);

  const setConversationHistory = useAppStore(
    (state) => state.setConversationHistory,
  );
  const setConnectionStatus = useAppStore((state) => state.setConnectionStatus);
  const setVoicePresentation = useAppStore((state) => state.setVoicePresentation);
  const setCaptionsEnabled = useAppStore((state) => state.setCaptionsEnabled);
  const setConferenceParticipants = useAppStore(
    (state) => state.setConferenceParticipants,
  );
  const setActiveSpeaker = useAppStore((state) => state.setActiveSpeaker);
  const clearConference = useAppStore((state) => state.clearConference);
  const upsertSession = useAppStore((state) => state.upsertSession);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [connectionState, setConnectionState] =
    useState<LiveVoiceConnectionState>('disconnected');

  const conferenceServiceRef = useRef<ReturnType<
    typeof createConferenceVoiceSessionService
  > | null>(null);
  const conferenceSessionRef = useRef<OpenClawConferenceSession | null>(null);

  const invitedAgents = useMemo(
    () => agents.filter((agent) => invitedAgentIds.includes(agent.id)),
    [agents, invitedAgentIds],
  );

  const agentNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const agent of invitedAgents) {
      names[agent.id] = agent.name;
    }
    return names;
  }, [invitedAgents]);

  const activeSpeakerName = useMemo(() => {
    if (!activeSpeakerAgentId) return null;
    return agentNames[activeSpeakerAgentId] ?? activeSpeakerAgentId;
  }, [activeSpeakerAgentId, agentNames]);

  const createClient = useCallback(
    () =>
      createOpenClawClient({
        gatewayUrl,
        authToken,
        isMockMode,
      }),
    [authToken, gatewayUrl, isMockMode],
  );

  const updateSessionPreview = useCallback(
    (preview: string, bumpCount: number) => {
      if (!selectedSessionId) return;

      const currentSession = useAppStore
        .getState()
        .sessions.find((s) => s.id === selectedSessionId);

      if (!currentSession) return;

      upsertSession({
        ...currentSession,
        preview,
        updatedAt: new Date().toISOString(),
        messageCount: currentSession.messageCount + bumpCount,
      });
    },
    [selectedSessionId, upsertSession],
  );

  const upsertConversationMessage = useCallback(
    (message: ConversationMessage) => {
      const current =
        useAppStore.getState().conversationHistory[message.sessionId] ?? [];
      const existingIndex = current.findIndex(
        (entry) => entry.id === message.id,
      );

      if (existingIndex === -1) {
        setConversationHistory(message.sessionId, [...current, message]);
        return true;
      }

      setConversationHistory(
        message.sessionId,
        current.map((entry, index) =>
          index === existingIndex ? { ...entry, ...message } : entry,
        ),
      );
      return false;
    },
    [setConversationHistory],
  );

  const handleConferenceTranscript = useCallback(
    (event: LiveVoiceTranscriptEvent) => {
      if (!selectedSessionId) return;

      const text = event.text.trim();
      if (!text) return;

      setErrorMessage(null);

      if (!event.final) {
        setVoicePresentation({
          liveTranscript: text,
          partialTranscript: text,
          voiceState: event.role === 'agent' ? 'speaking' : 'listening',
        });
        return;
      }

      const message: ConversationMessage = {
        id: `conf-${event.role}-${event.id}`,
        sessionId: selectedSessionId,
        role: event.role,
        agentId: event.agentId,
        agentName: event.agentName,
        text,
        createdAt: event.receivedAt,
        status: 'sent',
      };

      const isNew = upsertConversationMessage(message);

      if (isNew) {
        updateSessionPreview(text, 1);
      }

      setVoicePresentation({
        liveTranscript: text,
        partialTranscript: '',
        voiceState: event.role === 'user' ? 'processing' : 'listening',
      });
    },
    [
      selectedSessionId,
      setVoicePresentation,
      updateSessionPreview,
      upsertConversationMessage,
    ],
  );

  const disconnectConference = useCallback(async () => {
    const service = conferenceServiceRef.current;
    const session = conferenceSessionRef.current;

    conferenceServiceRef.current = null;
    conferenceSessionRef.current = null;
    setConnectionState('disconnected');

    if (service) {
      await service.disconnect();
    }

    if (session && selectedSessionId) {
      try {
        // End conference session on gateway
        await createClient().removeAgentFromConference(
          session.conferenceId,
          'all',
        );
      } catch {
        // Best-effort teardown
      }
    }

    setVoicePresentation({
      isSpeaking: false,
      liveTranscript: '',
      partialTranscript: '',
      volumeLevel: 0,
      voiceState: 'idle',
    });
    setConferenceParticipants([]);
    setActiveSpeaker(null);
  }, [
    createClient,
    selectedSessionId,
    setActiveSpeaker,
    setConferenceParticipants,
    setVoicePresentation,
  ]);

  const connectConference = useCallback(async () => {
    if (invitedAgentIds.length < 2 || !selectedSessionId) {
      setErrorMessage('Select at least 2 agents for a conference.');
      return;
    }

    const service = createConferenceVoiceSessionService();
    conferenceServiceRef.current = service;
    service.setAgentNames(agentNames);

    setConnectionState('connecting');
    setConnectionStatus('connecting');
    setErrorMessage(null);
    setVoicePresentation({
      voiceProvider: 'conference-livekit',
      liveTranscript: '',
      partialTranscript: '',
      voiceState: 'processing',
      isSpeaking: false,
      volumeLevel: 0,
    });

    try {
      const conferenceSession = await createClient().createConferenceSession(
        invitedAgentIds,
        selectedSessionId,
        {
          orchestrationMode: 'gateway',
          enableAgentToAgent: true,
        },
      );

      conferenceSessionRef.current = conferenceSession;

      await service.connect(
        conferenceSession,
        {
          onConnectionStateChange: (state) => {
            setConnectionState(state);

            if (state === 'connected') {
              setConnectionStatus('connected');
            } else if (state === 'connecting' || state === 'reconnecting') {
              setConnectionStatus('connecting');
            } else {
              setConnectionStatus('offline', 'Conference disconnected.');
            }
          },
          onVoiceStateChange: (state) => {
            setVoicePresentation({
              voiceProvider: 'conference-livekit',
              voiceState: state,
            });
          },
          onTranscript: handleConferenceTranscript,
          onSpeakingStatusChange: (speaking) => {
            setVoicePresentation({ isSpeaking: speaking });
          },
          onVolumeChange: (value) => {
            setVoicePresentation({ volumeLevel: Math.max(0, value) });
          },
          onError: (message) => {
            setErrorMessage(message);
            setVoicePresentation({
              isSpeaking: false,
              volumeLevel: 0,
              voiceState: 'error',
            });
          },
          onParticipantJoined: (participant: ConferenceParticipant) => {
            setConferenceParticipants([
              ...useAppStore.getState().conferenceParticipants,
              participant,
            ]);
          },
          onParticipantLeft: (participant: ConferenceParticipant) => {
            setConferenceParticipants(
              useAppStore
                .getState()
                .conferenceParticipants.filter(
                  (p) => p.identity !== participant.identity,
                ),
            );
          },
          onActiveSpeakerChanged: (speakerId, agentId) => {
            setActiveSpeaker(speakerId, agentId);
          },
          onControlMessage: (message) => {
            // Handle orchestration messages if needed
            console.log('[Conference] Control message:', message.type);
          },
        },
        { startMuted: false },
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to start conference.';

      setErrorMessage(message);
      setConnectionState('disconnected');
      setConnectionStatus('offline', message);
      setVoicePresentation({
        isSpeaking: false,
        volumeLevel: 0,
        voiceState: 'error',
      });
      await disconnectConference();
    }
  }, [
    agentNames,
    createClient,
    disconnectConference,
    handleConferenceTranscript,
    invitedAgentIds,
    selectedSessionId,
    setActiveSpeaker,
    setConferenceParticipants,
    setConnectionStatus,
    setVoicePresentation,
  ]);

  // Setup mock participants for mock mode
  const setupMockConference = useCallback(() => {
    const mockParticipants: ConferenceParticipant[] = [
      {
        id: 'user-1',
        identity: 'user-1',
        type: 'user',
        name: 'You',
        status: 'active',
        isMuted: false,
      },
      ...invitedAgents.map((agent) => ({
        id: agent.id,
        identity: `agent-${agent.id}`,
        type: 'agent' as const,
        agentId: agent.id,
        name: agent.name,
        status: 'active' as const,
        isMuted: false,
      })),
    ];

    setConferenceParticipants(mockParticipants);
    setConnectionState('connected');
    setConnectionStatus('connected');
    setVoicePresentation({
      voiceProvider: 'mock-conference',
      voiceState: 'listening',
      liveTranscript: '',
      partialTranscript: '',
      isSpeaking: false,
      volumeLevel: 0,
    });
  }, [invitedAgents, setConferenceParticipants, setConnectionStatus, setVoicePresentation]);

  // Connect on mount
  useEffect(() => {
    if (invitedAgentIds.length >= 2) {
      if (isMockMode) {
        // In mock mode, simulate the conference without LiveKit
        setupMockConference();
      } else {
        void connectConference();
      }
    }

    return () => {
      if (!isMockMode) {
        void disconnectConference();
      } else {
        setConferenceParticipants([]);
        setActiveSpeaker(null);
      }
    };
  }, [connectConference, disconnectConference, invitedAgentIds.length, isMockMode, setupMockConference, setConferenceParticipants, setActiveSpeaker]);

  const handleMuteToggle = async () => {
    const nextMuted = !micMuted;
    setMicMuted(nextMuted);

    if (isMockMode) {
      setVoicePresentation({
        voiceState: nextMuted ? 'idle' : 'listening',
        volumeLevel: nextMuted ? 0 : 0.5,
      });
      return;
    }

    const service = conferenceServiceRef.current;
    if (!service) return;

    await service.setMicrophoneEnabled(!nextMuted);

    setVoicePresentation({
      voiceState: nextMuted ? 'idle' : 'listening',
      volumeLevel: nextMuted ? 0 : useAppStore.getState().volumeLevel,
    });
  };

  const handleInterrupt = async () => {
    if (isMockMode) {
      setVoicePresentation({
        isSpeaking: false,
        voiceState: micMuted ? 'idle' : 'listening',
      });
      setActiveSpeaker(null);
      return;
    }

    const service = conferenceServiceRef.current;
    if (!service) return;

    await service.interrupt();
    setVoicePresentation({
      isSpeaking: false,
      voiceState: micMuted ? 'idle' : 'listening',
    });
  };

  const endConference = async () => {
    if (!isMockMode) {
      await disconnectConference();
    } else {
      setConferenceParticipants([]);
      setActiveSpeaker(null);
      setVoicePresentation({
        voiceState: 'idle',
        liveTranscript: '',
        partialTranscript: '',
        isSpeaking: false,
        volumeLevel: 0,
      });
    }
    clearConference();
    navigation.navigate('AgentSelector');
  };

  const toggleCaptions = () => {
    setCaptionsEnabled(!captionsEnabled);
  };

  const messages = selectedSessionId
    ? conversationHistory[selectedSessionId] ?? []
    : [];

  const latestMessage = useMemo(
    () =>
      [...messages].reverse().find((m) => m.role === 'agent')?.text ?? '',
    [messages],
  );

  const captionText = partialTranscript || liveTranscript || latestMessage;
  const shouldShowCaptions = captionsEnabled || Boolean(partialTranscript);

  const statusTitle =
    connectionState === 'connecting'
      ? 'Connecting...'
      : connectionState === 'reconnecting'
        ? 'Reconnecting...'
        : activeSpeakerName
          ? `${activeSpeakerName} is speaking`
          : voiceState === 'processing'
            ? 'Thinking...'
            : voiceState === 'speaking'
              ? 'Speaking...'
              : micMuted
                ? 'Muted'
                : 'Listening';

  const statusCopy =
    connectionState === 'connecting'
      ? `Setting up conference with ${invitedAgents.length} agents...`
      : `Conference with ${invitedAgents.map((a) => a.name).join(', ')}`;

  // Guard: no agents selected
  if (invitedAgentIds.length < 2) {
    return (
      <ScreenContainer contentContainerStyle={styles.centered}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          No agents selected
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          Select at least 2 agents to start a conference.
        </Text>
        <PrimaryButton
          label="Select agents"
          onPress={() => navigation.replace('AgentMultiSelect')}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerMeta}>
            <Text style={[styles.agentLabel, { color: theme.colors.accent }]}>
              Conference Call
            </Text>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {invitedAgents.length} Agents
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
              {gatewayLabel ?? gatewayUrl}
            </Text>
          </View>
          <StatusPill status={connectionStatus} />
        </View>

        <View style={styles.topButtons}>
          <Pressable
            onPress={() => navigation.navigate('ConversationHistory')}
            style={[
              styles.topButton,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.pill,
              },
            ]}
          >
            <Text style={[styles.topButtonText, { color: theme.colors.text }]}>
              History
            </Text>
          </Pressable>
          <Pressable
            onPress={toggleCaptions}
            style={[
              styles.topButton,
              {
                backgroundColor: captionsEnabled
                  ? theme.colors.primarySoft
                  : theme.colors.surface,
                borderColor: captionsEnabled
                  ? theme.colors.primary
                  : theme.colors.border,
                borderRadius: theme.radii.pill,
              },
            ]}
          >
            <Text
              style={[
                styles.topButtonText,
                {
                  color: captionsEnabled
                    ? theme.colors.primary
                    : theme.colors.text,
                },
              ]}
            >
              CC
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.centerArea}>
        <ConferenceVisualizer
          participants={conferenceParticipants}
          activeSpeakerId={activeSpeakerId}
          voiceState={voiceState}
          volumeLevel={volumeLevel}
        />

        <View style={styles.statusBlock}>
          <Text style={[styles.statusTitle, { color: theme.colors.text }]}>
            {statusTitle}
          </Text>
          <Text style={[styles.statusCopy, { color: theme.colors.textMuted }]}>
            {statusCopy}
          </Text>
        </View>

        {shouldShowCaptions && (
          <View
            style={[
              styles.captionCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.lg,
              },
            ]}
          >
            <Text
              style={[styles.captionLabel, { color: theme.colors.textMuted }]}
            >
              {partialTranscript
                ? 'Live caption'
                : activeSpeakerName
                  ? `${activeSpeakerName} said`
                  : 'Latest'}
            </Text>
            <Text style={[styles.captionText, { color: theme.colors.text }]}>
              {captionText ||
                'Captions will appear here during the conversation.'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.bottomArea}>
        <View style={styles.controlRow}>
          <Pressable
            onPress={() => navigation.navigate('ConversationHistory')}
            style={[
              styles.secondaryControl,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.round,
              },
            ]}
          >
            <Text
              style={[
                styles.secondaryControlText,
                { color: theme.colors.text },
              ]}
            >
              Log
            </Text>
          </Pressable>

          <Pressable
            onPress={
              voiceState === 'speaking'
                ? () => void handleInterrupt()
                : () => void handleMuteToggle()
            }
            style={[
              styles.primaryControl,
              {
                backgroundColor:
                  voiceState === 'speaking'
                    ? theme.colors.warning
                    : micMuted
                      ? theme.colors.surface
                      : theme.colors.primary,
                borderColor: micMuted
                  ? theme.colors.border
                  : theme.colors.primary,
                borderRadius: theme.radii.round,
              },
            ]}
          >
            <Text
              style={[
                styles.primaryControlLabel,
                { color: micMuted ? theme.colors.text : '#ffffff' },
              ]}
            >
              {voiceState === 'speaking'
                ? 'Interrupt'
                : micMuted
                  ? 'Unmute'
                  : 'Mute'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => void endConference()}
            style={[
              styles.secondaryControl,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.danger,
                borderRadius: theme.radii.round,
              },
            ]}
          >
            <Text
              style={[
                styles.secondaryControlText,
                { color: theme.colors.danger },
              ]}
            >
              End
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.footerNote, { color: theme.colors.textMuted }]}>
          Transcripts are attributed to each agent in history.
        </Text>

        {errorMessage && (
          <Text style={[styles.errorText, { color: theme.colors.danger }]}>
            {errorMessage}
          </Text>
        )}
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'space-between',
  },
  centered: {
    alignItems: 'center',
    gap: 16,
    justifyContent: 'center',
  },
  header: {
    gap: 14,
  },
  headerTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
  },
  headerMeta: {
    gap: 6,
  },
  topButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  topButton: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  topButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  agentLabel: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
  },
  centerArea: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  statusBlock: {
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  statusTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  statusCopy: {
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 320,
    textAlign: 'center',
  },
  captionCard: {
    borderWidth: 1,
    gap: 8,
    marginTop: 28,
    minHeight: 94,
    padding: 18,
    width: '100%',
  },
  captionLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  captionText: {
    fontSize: 17,
    lineHeight: 25,
  },
  bottomArea: {
    gap: 14,
  },
  controlRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  secondaryControl: {
    alignItems: 'center',
    borderWidth: 1,
    height: 76,
    justifyContent: 'center',
    width: 76,
  },
  secondaryControlText: {
    fontSize: 14,
    fontWeight: '700',
  },
  primaryControl: {
    alignItems: 'center',
    borderWidth: 1,
    height: 118,
    justifyContent: 'center',
    width: 118,
  },
  primaryControlLabel: {
    fontSize: 18,
    fontWeight: '800',
  },
  footerNote: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
