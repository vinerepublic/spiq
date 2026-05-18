export type ConnectionMethod = 'auto' | 'manual' | 'qr' | 'mock';

export type GatewayConnectionStatus =
  | 'unconfigured'
  | 'discovering'
  | 'connecting'
  | 'pairing'
  | 'connected'
  | 'offline'
  | 'error';

export type VoiceInteractionState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'error';

export type MessageRole = 'user' | 'agent' | 'system';

export interface GatewayCandidate {
  id: string;
  name: string;
  url: string;
  source: ConnectionMethod | 'lan-scan' | 'mdns';
  latencyMs?: number;
  isMock?: boolean;
  pairingToken?: string;
  health?: GatewayHealth;
}

export interface GatewayHealth {
  status: 'ok' | 'degraded';
  gatewayName?: string;
  version?: string;
  message?: string;
}

export interface GatewayPairingResult {
  token: string;
  gatewayLabel?: string;
  expiresAt?: string;
}

export interface AgentSummary {
  id: string;
  name: string;
  description: string;
  status: 'available' | 'busy' | 'offline';
  capabilities: string[];
  defaultSessionTitle?: string;
}

export interface SessionSummary {
  id: string;
  agentId: string;
  title: string;
  preview: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ConversationMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  agentId?: string;           // For multi-agent: which agent sent this
  agentName?: string;         // For multi-agent: display name for attribution
  text: string;
  createdAt: string;
  status?: 'sending' | 'sent' | 'failed';
}

/**
 * Conference participant (user or agent) in a multi-agent call
 */
export type ConferenceParticipantStatus = 'joining' | 'active' | 'speaking' | 'left';

export interface ConferenceParticipant {
  id: string;
  identity: string;           // LiveKit participant identity
  type: 'user' | 'agent';
  agentId?: string;           // Only for agents
  name: string;
  status: ConferenceParticipantStatus;
  isMuted: boolean;
  joinedAt?: string;
}

/**
 * Configuration for an agent joining a conference
 */
export interface AgentConferenceConfig {
  agentId: string;
  persona?: string;           // Optional persona override for this session
  expertise?: string[];       // Topics this agent should respond to
  priority?: number;          // Turn-taking priority (lower = speaks first)
}

export interface PersistedAppState {
  gatewayUrl: string;
  gatewayLabel: string | null;
  authToken: string | null;
  selectedAgentId: string | null;
  selectedSessionId: string | null;
  isMockMode: boolean;
  continuousMode: boolean;
  ttsEnabled: boolean;
  captionsEnabled: boolean;
}

export interface AppError {
  code: string;
  message: string;
  recoverable: boolean;
}
