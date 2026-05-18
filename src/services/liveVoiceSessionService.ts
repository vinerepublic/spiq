import type { AudioSession as LiveKitAudioSessionModule } from '@livekit/react-native';
import type {
  ChatMessage,
  ConnectionState,
  Participant,
  Room,
  RoomEvent,
  TranscriptionSegment,
} from 'livekit-client';

import type {
  LiveVoiceChatEvent,
  LiveVoiceConnectionState,
  LiveVoiceSessionCallbacks,
  LiveVoiceTranscriptEvent,
  OpenClawLiveVoiceSession,
} from '../types/realtime';
import type { VoiceInteractionState } from '../types/app';

type LiveKitReactNativeModule = typeof import('@livekit/react-native');
type LiveKitClientModule = typeof import('livekit-client');

const loadLiveKitReactNative = () => {
  try {
    return require('@livekit/react-native') as LiveKitReactNativeModule;
  } catch {
    throw new Error(
      'Live voice requires a native development build. Expo Go does not include the LiveKit WebRTC modules.',
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

export class LiveVoiceSessionService {
  private room: Room | null = null;
  private callbacks: LiveVoiceSessionCallbacks = {};
  private session: OpenClawLiveVoiceSession | null = null;
  private audioSession: typeof LiveKitAudioSessionModule | null = null;
  private microphoneEnabled = false;

  async connect(
    session: OpenClawLiveVoiceSession,
    callbacks: LiveVoiceSessionCallbacks,
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

    callbacks.onConnectionStateChange?.('connecting');
    callbacks.onVoiceStateChange?.('processing');

    await AudioSession.startAudioSession();

    const room = new Room();
    this.room = room;
    this.bindRoom(room, RoomEvent, ConnectionState);

    try {
      await room.connect(session.serverUrl, session.token, {
        autoSubscribe: true,
      });

      await room.localParticipant.setMicrophoneEnabled(this.microphoneEnabled);
      callbacks.onConnectionStateChange?.('connected');
      callbacks.onVoiceStateChange?.(
        this.microphoneEnabled ? 'listening' : 'idle',
      );
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

    if (room) {
      room.removeAllListeners();
      await room.disconnect();
    }

    if (this.audioSession) {
      await this.audioSession.stopAudioSession();
    }

    this.audioSession = null;
  }

  async setMicrophoneEnabled(enabled: boolean) {
    this.microphoneEnabled = enabled;

    if (!this.room) {
      return;
    }

    await this.room.localParticipant.setMicrophoneEnabled(enabled);
    this.callbacks.onVoiceStateChange?.(enabled ? 'listening' : 'idle');
  }

  async interrupt() {
    if (!this.room || !this.session) {
      return;
    }

    const payload = JSON.stringify({
      type: 'interrupt',
      reason: 'user-barge-in',
      sessionId: this.session.sessionId,
    });

    try {
      await this.room.localParticipant.sendText(payload, {
        topic: this.session.controlTopic ?? 'openclaw.control',
      });
    } catch {
      // If the backend does not consume control messages, opening the mic still
      // allows VAD-based interruption on the agent side.
    }

    this.callbacks.onSpeakingStatusChange?.(false);
    this.callbacks.onVoiceStateChange?.(
      this.microphoneEnabled ? 'listening' : 'idle',
    );
  }

  private bindRoom(
    room: Room,
    roomEvent: typeof RoomEvent,
    connectionState: typeof ConnectionState,
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
        this.callbacks.onVolumeChange?.(0);
        this.callbacks.onVoiceStateChange?.('idle');
      }
    });

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

      const remoteSpeaking = participants.some((participant) =>
        this.isAgentParticipant(participant, room),
      );
      const localSpeaking = participants.some(
        (participant) => participant.identity === room.localParticipant.identity,
      );

      this.callbacks.onVolumeChange?.(volumeLevel);
      this.callbacks.onSpeakingStatusChange?.(remoteSpeaking);

      if (remoteSpeaking) {
        this.callbacks.onVoiceStateChange?.('speaking');
      } else if (localSpeaking) {
        this.callbacks.onVoiceStateChange?.('listening');
      } else {
        this.callbacks.onVoiceStateChange?.(
          this.microphoneEnabled ? 'listening' : 'idle',
        );
      }
    });

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

    room.on(roomEvent.MediaDevicesError, (error) => {
      this.callbacks.onError?.(
        error.message || 'Unable to access microphone or audio output.',
      );
      this.callbacks.onVoiceStateChange?.('error');
    });

    room.on(roomEvent.Disconnected, () => {
      this.callbacks.onConnectionStateChange?.('disconnected');
      this.callbacks.onSpeakingStatusChange?.(false);
      this.callbacks.onVolumeChange?.(0);
      this.callbacks.onVoiceStateChange?.('idle');
    });
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
    const role =
      participant?.identity === room.localParticipant.identity ? 'user' : 'agent';

    return {
      id: segment.id,
      role,
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

  private isAgentParticipant(participant: Participant, room: Room) {
    if (participant.identity === room.localParticipant.identity) {
      return false;
    }

    if (this.session?.agentIdentity) {
      return participant.identity === this.session.agentIdentity;
    }

    return true;
  }
}

export const createLiveVoiceSessionService = () =>
  new LiveVoiceSessionService();
