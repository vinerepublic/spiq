import type { VoiceInteractionState } from './app';

export type VoiceTransportMode = 'legacy' | 'livekit' | 'openai-realtime';
export type LiveVoiceTransport = 'livekit-room' | 'openai-realtime';

export interface OpenClawLiveVoiceSession {
  id: string;
  sessionId: string;
  agentId: string;
  transport: LiveVoiceTransport;
  serverUrl: string;
  token: string;
  roomName: string;
  participantIdentity?: string;
  agentIdentity?: string;
  controlTopic?: string;
  expiresAt?: string;
}

export type LiveVoiceConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

export interface LiveVoiceTranscriptEvent {
  id: string;
  role: 'user' | 'agent';
  agentId?: string;           // For multi-agent: which agent spoke
  agentName?: string;         // For multi-agent: display name
  text: string;
  final: boolean;
  participantIdentity?: string;
  receivedAt: string;
}

export interface LiveVoiceChatEvent {
  id: string;
  role: 'user' | 'agent';
  text: string;
  participantIdentity?: string;
  receivedAt: string;
}

export interface LiveVoiceSessionCallbacks {
  onConnectionStateChange?: (state: LiveVoiceConnectionState) => void;
  onVoiceStateChange?: (state: VoiceInteractionState) => void;
  onTranscript?: (event: LiveVoiceTranscriptEvent) => void;
  onChatMessage?: (event: LiveVoiceChatEvent) => void;
  onSpeakingStatusChange?: (isSpeaking: boolean) => void;
  onVolumeChange?: (value: number) => void;
  onError?: (message: string) => void;
}

// ============================================================================
// Multi-Agent Conference Types
// ============================================================================

import type { ConferenceParticipant } from './app';

/**
 * Extended session for multi-agent conferences
 */
export interface OpenClawConferenceSession extends OpenClawLiveVoiceSession {
  conferenceId: string;
  invitedAgentIds: string[];
  agentIdentities: Record<string, string>;  // agentId -> participantIdentity
  orchestrationTopic: string;               // Topic for turn-taking control
}

/**
 * Control message types for conference orchestration
 */
export type ConferenceControlMessageType =
  | 'turn-request'      // Agent wants to speak
  | 'turn-granted'      // Gateway grants turn
  | 'turn-release'      // Agent finished speaking
  | 'interrupt'         // User barge-in
  | 'agent-join'        // Agent joined room
  | 'agent-leave'       // Agent left room
  | 'topic-hint';       // Client hints at topic for routing

/**
 * Control message sent via LiveKit data channel for orchestration
 */
export interface ConferenceControlMessage {
  type: ConferenceControlMessageType;
  sessionId: string;
  agentId?: string;
  payload?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Extended callbacks for multi-agent conference sessions
 */
export interface ConferenceVoiceCallbacks extends LiveVoiceSessionCallbacks {
  onParticipantJoined?: (participant: ConferenceParticipant) => void;
  onParticipantLeft?: (participant: ConferenceParticipant) => void;
  onActiveSpeakerChanged?: (speakerId: string | null, agentId?: string) => void;
  onControlMessage?: (message: ConferenceControlMessage) => void;
}

/**
 * Configuration for creating a conference session
 */
export interface ConferenceConfig {
  orchestrationMode?: 'gateway' | 'client-hints';
  maxConcurrentSpeakers?: number;
  turnTimeoutMs?: number;
  enableAgentToAgent?: boolean;  // Allow agents to respond to each other
}
