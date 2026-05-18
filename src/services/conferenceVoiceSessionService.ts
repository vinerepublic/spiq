/**
 * Conference Voice Session Service
 * Extends LiveVoiceSessionService for multi-agent conference calls
 */

import type { AudioSession as LiveKitAudioSessionModule } from '@livekit/react-native';
import type {
  ChatMessage,
  ConnectionState,
  DataPacket_Kind,
  Participant,
  Room,
  RoomEvent,
  TranscriptionSegment,
} from 'livekit-client';

import type { ConferenceParticipant, VoiceInteractionState } from '../types/app';
import type {
  ConferenceControlMessage,
  ConferenceVoiceCallbacks,
  LiveVoiceChatEvent,
  LiveVoiceConnectionState,
  LiveVoiceTranscriptEvent,
  OpenClawConferenceSession,
} from '../types/realtime';

type LiveKitReactNativeModule = typeof import('@livekit/react-native');
type LiveKitClientModule = typeof import('livekit-client');

const loadLiveKitReactNative = () => {
  try {
    return require('@livekit/react-native') as LiveKitReactNativeModule;
  } catch {
    throw new Error(
      'Conference voice requires a native development build. Expo Go does not include the LiveKit WebRTC modules.',
    );
  }
};

const loadLiveKitClient = () => {
  try {
    return require('livekit-client') as LiveKitClientModule;
  } catch {
    throw new Error('LiveKit client modules are unavailable in this build.');
  }
};

export class ConferenceVoiceSessionService {
  private room: Room | null = null;
  private callbacks: ConferenceVoiceCallbacks = {};
  private session: OpenClawConferenceSession | null = null;
  private audioSession: typeof LiveKitAudioSessionModule | null = null;
  private microphoneEnabled = false;
  private participants: Map<string, ConferenceParticipant> = new Map();
  private agentNames: Map<string, string> = new Map();

  /**
   * Set agent display names for attribution
   */
  setAgentNames(names: Map<string, string> | Record<string, string>) {
    if (names instanceof Map) {
      this.agentNames = names;
    } else {
      this.agentNames = new Map(Object.entries(names));
    }
  }

  async connect(
    session: OpenClawConferenceSession,
    callbacks: ConferenceVoiceCallbacks,
    options: { startMuted: boolean },
  ) {
    await this.disconnect();

    const reactNativeModule = loadLiveKitReactNative();
    const liveKitClient = loadLiveKitClient();
    const { AudioSession } = reactNativeModule;
    const { Room, RoomEvent, ConnectionState } = liveKitClient;

    this.callbacks = callbacks;
    this.session = session;
    this.audioSession = AudioSession;
    this.microphoneEnabled = !options.startMuted;
    this.participants.clear();

    callbacks.onConnectionStateChange?.('connecting');
    callbacks.onVoiceStateChange?.('processing');

    await AudioSession.startAudioSession();

    const room = new Room();
    this.room = room;
    this.bindRoom(room, RoomEvent, ConnectionState, liveKitClient);

    try {
      await room.connect(session.serverUrl, session.token, {
        autoSubscribe: true,
      });

      await room.localParticipant.setMicrophoneEnabled(this.microphoneEnabled);
      callbacks.onConnectionStateChange?.('connected');
      callbacks.onVoiceStateChange?.(
        this.microphoneEnabled ? 'listening' : 'idle',
      );

      // Add existing participants to tracking
      for (const participant of room.remoteParticipants.values()) {
        this.handleParticipantJoined(participant, room);
      }
    } catch (error) {
      await this.disconnect();
      throw error;
    }
  }

  async disconnect() {
    const room = this.room;
    this.room = null;
    this.session = null;
    this.microphoneEnabled = false;
    this.participants.clear();

    if (room) {
      room.removeAllListeners();
      await room.disconnect();
    }

    if (this.audioSession) {
      await this.audioSession.stopAudioSession();
    }

    this.audioSession = null;
    this.callbacks.onConnectionStateChange?.('disconnected');
  }

  async setMicrophoneEnabled(enabled: boolean) {
    this.microphoneEnabled = enabled;

    if (!this.room) {
      return;
    }

    await this.room.localParticipant.setMicrophoneEnabled(enabled);
    this.callbacks.onVoiceStateChange?.(enabled ? 'listening' : 'idle');
  }

  async interrupt(targetAgentIds?: string[]) {
    if (!this.room || !this.session) {
      return;
    }

    const message: ConferenceControlMessage = {
      type: 'interrupt',
      sessionId: this.session.sessionId,
      payload: {
        reason: 'user-barge-in',
        targetAgentIds,
      },
      timestamp: new Date().toISOString(),
    };

    const payload = JSON.stringify(message);

    try {
      await this.room.localParticipant.sendText(payload, {
        topic: this.session.orchestrationTopic ?? 'openclaw.conference.control',
      });
    } catch {
      // If the backend does not consume control messages, opening the mic still
      // allows VAD-based interruption on the agent side.
    }

    this.callbacks.onSpeakingStatusChange?.(false);
    this.callbacks.onActiveSpeakerChanged?.(null);
    this.callbacks.onVoiceStateChange?.(
      this.microphoneEnabled ? 'listening' : 'idle',
    );
  }

  /**
   * Send a topic hint to help Gateway route to appropriate agents
   */
  async sendTopicHint(topic: string) {
    if (!this.room || !this.session) {
      return;
    }

    const message: ConferenceControlMessage = {
      type: 'topic-hint',
      sessionId: this.session.sessionId,
      payload: { topic },
      timestamp: new Date().toISOString(),
    };

    try {
      await this.room.localParticipant.sendText(JSON.stringify(message), {
        topic: this.session.orchestrationTopic ?? 'openclaw.conference.control',
      });
    } catch {
      // Ignore send errors for optional hints
    }
  }

  /**
   * Get the current list of participants
   */
  getParticipants(): ConferenceParticipant[] {
    return Array.from(this.participants.values());
  }

  private handleParticipantJoined(participant: Participant, room: Room) {
    if (participant.identity === room.localParticipant.identity) {
      return; // Skip local participant
    }

    const agentId = this.resolveAgentId(participant.identity);
    const conferenceParticipant: ConferenceParticipant = {
      id: participant.sid,
      identity: participant.identity,
      type: agentId ? 'agent' : 'user',
      agentId,
      name: this.getAgentName(agentId) ?? participant.identity,
      status: 'active',
      isMuted: false,
      joinedAt: new Date().toISOString(),
    };

    this.participants.set(participant.identity, conferenceParticipant);
    this.callbacks.onParticipantJoined?.(conferenceParticipant);
  }

  private handleParticipantLeft(participant: Participant) {
    const conferenceParticipant = this.participants.get(participant.identity);
    if (conferenceParticipant) {
      conferenceParticipant.status = 'left';
      this.callbacks.onParticipantLeft?.(conferenceParticipant);
      this.participants.delete(participant.identity);
    }
  }

  private bindRoom(
    room: Room,
    roomEvent: typeof RoomEvent,
    connectionState: typeof ConnectionState,
    _liveKitClient: LiveKitClientModule,
  ) {
    room.on(roomEvent.ConnectionStateChanged, (state) => {
      this.callbacks.onConnectionStateChange?.(
        this.mapConnectionState(state, connectionState),
      );

      if (state === connectionState.Reconnecting) {
        this.callbacks.onVoiceStateChange?.('processing');
        return;
      }

      if (state === connectionState.Connected) {
        this.callbacks.onVoiceStateChange?.(
          this.microphoneEnabled ? 'listening' : 'idle',
        );
        return;
      }

      if (state === connectionState.Disconnected) {
        this.callbacks.onSpeakingStatusChange?.(false);
        this.callbacks.onActiveSpeakerChanged?.(null);
        this.callbacks.onVolumeChange?.(0);
        this.callbacks.onVoiceStateChange?.('idle');
      }
    });

    // Track participant connections
    room.on(roomEvent.ParticipantConnected, (participant) => {
      this.handleParticipantJoined(participant, room);
    });

    room.on(roomEvent.ParticipantDisconnected, (participant) => {
      this.handleParticipantLeft(participant);
    });

    // Enhanced active speaker tracking with agent identification
    room.on(roomEvent.ActiveSpeakersChanged, (participants) => {
      const volumeLevel = Math.round(
        participants.reduce((max, participant) => {
          const nextLevel =
            typeof participant.audioLevel === 'number'
              ? participant.audioLevel
              : 0;
          return Math.max(max, nextLevel);
        }, 0) * 12,
      );

      const remoteSpeakers = participants.filter((participant) =>
        this.isAgentParticipant(participant, room),
      );
      const localSpeaking = participants.some(
        (participant) => participant.identity === room.localParticipant.identity,
      );

      this.callbacks.onVolumeChange?.(volumeLevel);

      if (remoteSpeakers.length > 0) {
        const primarySpeaker = remoteSpeakers[0];
        const agentId = this.resolveAgentId(primarySpeaker.identity);

        // Update participant status
        const conferenceParticipant = this.participants.get(
          primarySpeaker.identity,
        );
        if (conferenceParticipant) {
          conferenceParticipant.status = 'speaking';
        }

        this.callbacks.onSpeakingStatusChange?.(true);
        this.callbacks.onActiveSpeakerChanged?.(
          primarySpeaker.identity,
          agentId,
        );
        this.callbacks.onVoiceStateChange?.('speaking');
      } else if (localSpeaking) {
        this.callbacks.onSpeakingStatusChange?.(false);
        this.callbacks.onActiveSpeakerChanged?.(null);
        this.callbacks.onVoiceStateChange?.('listening');
      } else {
        // Reset speaking status for all participants
        for (const p of this.participants.values()) {
          if (p.status === 'speaking') {
            p.status = 'active';
          }
        }
        this.callbacks.onSpeakingStatusChange?.(false);
        this.callbacks.onActiveSpeakerChanged?.(null);
        this.callbacks.onVoiceStateChange?.(
          this.microphoneEnabled ? 'listening' : 'idle',
        );
      }
    });

    // Transcription with agent attribution
    room.on(
      roomEvent.TranscriptionReceived,
      (segments, participant) => {
        for (const segment of segments) {
          this.callbacks.onTranscript?.(
            this.mapTranscriptEvent(room, segment, participant),
          );
        }
      },
    );

    room.on(roomEvent.ChatMessage, (message, participant) => {
      if (!message.message.trim()) {
        return;
      }

      this.callbacks.onChatMessage?.(
        this.mapChatMessageEvent(room, message, participant),
      );
    });

    // Handle control messages from orchestration topic
    room.on(
      roomEvent.DataReceived,
      (
        payload: Uint8Array,
        participant: Participant | undefined,
        _kind: DataPacket_Kind | undefined,
        topic: string | undefined,
      ) => {
        const orchestrationTopic =
          this.session?.orchestrationTopic ?? 'openclaw.conference.control';

        if (topic === orchestrationTopic) {
          try {
            const message = JSON.parse(
              new TextDecoder().decode(payload),
            ) as ConferenceControlMessage;
            this.handleControlMessage(message);
          } catch {
            // Invalid control message, ignore
          }
        }
      },
    );

    room.on(roomEvent.MediaDevicesError, (error) => {
      this.callbacks.onError?.(
        error.message || 'Unable to access microphone or audio output.',
      );
      this.callbacks.onVoiceStateChange?.('error');
    });

    room.on(roomEvent.Disconnected, () => {
      this.callbacks.onConnectionStateChange?.('disconnected');
      this.callbacks.onSpeakingStatusChange?.(false);
      this.callbacks.onActiveSpeakerChanged?.(null);
      this.callbacks.onVolumeChange?.(0);
      this.callbacks.onVoiceStateChange?.('idle');
    });
  }

  private handleControlMessage(message: ConferenceControlMessage) {
    this.callbacks.onControlMessage?.(message);

    switch (message.type) {
      case 'turn-granted':
        if (message.agentId) {
          const identity = this.session?.agentIdentities[message.agentId];
          if (identity) {
            this.callbacks.onActiveSpeakerChanged?.(identity, message.agentId);
          }
        }
        break;

      case 'turn-release':
        this.callbacks.onActiveSpeakerChanged?.(null);
        break;

      case 'agent-join':
        // Agent joining is handled by ParticipantConnected event
        break;

      case 'agent-leave':
        // Agent leaving is handled by ParticipantDisconnected event
        break;
    }
  }

  private mapConnectionState(
    state: ConnectionState,
    connectionState: typeof ConnectionState,
  ): LiveVoiceConnectionState {
    if (
      state === connectionState.Reconnecting ||
      state === connectionState.SignalReconnecting
    ) {
      return 'reconnecting';
    }

    if (state === connectionState.Connected) {
      return 'connected';
    }

    if (state === connectionState.Connecting) {
      return 'connecting';
    }

    return 'disconnected';
  }

  private mapTranscriptEvent(
    room: Room,
    segment: TranscriptionSegment,
    participant?: Participant,
  ): LiveVoiceTranscriptEvent {
    const isLocal =
      participant?.identity === room.localParticipant.identity;
    const agentId = !isLocal
      ? this.resolveAgentId(participant?.identity)
      : undefined;

    return {
      id: segment.id,
      role: isLocal ? 'user' : 'agent',
      agentId,
      agentName: agentId ? this.getAgentName(agentId) : undefined,
      text: segment.text,
      final: segment.final,
      participantIdentity: participant?.identity,
      receivedAt: new Date().toISOString(),
    };
  }

  private mapChatMessageEvent(
    room: Room,
    message: ChatMessage,
    participant?: Participant,
  ): LiveVoiceChatEvent {
    const role =
      participant?.identity === room.localParticipant.identity ? 'user' : 'agent';

    return {
      id: message.id,
      role,
      text: message.message,
      participantIdentity: participant?.identity,
      receivedAt: new Date(message.timestamp).toISOString(),
    };
  }

  /**
   * Resolve agent ID from participant identity
   */
  private resolveAgentId(identity?: string): string | undefined {
    if (!identity || !this.session) {
      return undefined;
    }

    // Reverse lookup from agentIdentities map
    for (const [agentId, agentIdentity] of Object.entries(
      this.session.agentIdentities,
    )) {
      if (agentIdentity === identity) {
        return agentId;
      }
    }

    return undefined;
  }

  /**
   * Get display name for an agent
   */
  private getAgentName(agentId?: string): string | undefined {
    if (!agentId) {
      return undefined;
    }
    return this.agentNames.get(agentId);
  }

  private isAgentParticipant(participant: Participant, room: Room) {
    if (participant.identity === room.localParticipant.identity) {
      return false;
    }

    // Check if participant is any of the invited agents
    if (this.session?.agentIdentities) {
      const agentIdentities = Object.values(this.session.agentIdentities);
      return agentIdentities.includes(participant.identity);
    }

    // Fallback: assume any remote participant is an agent
    return true;
  }
}

export const createConferenceVoiceSessionService = () =>
  new ConferenceVoiceSessionService();
