import { create } from 'zustand';

import type {
  AgentSummary,
  ConferenceParticipant,
  ConversationMessage,
  GatewayCandidate,
  GatewayConnectionStatus,
  PersistedAppState,
  SessionSummary,
  VoiceInteractionState,
} from '../types/app';
import type { OpenClawConferenceSession } from '../types/realtime';
import { appEnv } from '../config/env';
import { secureStorageService } from '../services/secureStorageService';

interface AppStore {
  hydrated: boolean;
  gatewayUrl: string;
  gatewayLabel: string | null;
  authToken: string | null;
  isMockMode: boolean;
  connectionMethod: 'auto' | 'manual' | 'qr' | 'mock';
  connectionStatus: GatewayConnectionStatus;
  connectionError: string | null;
  discoveredGateways: GatewayCandidate[];
  agents: AgentSummary[];
  selectedAgentId: string | null;
  sessions: SessionSummary[];
  selectedSessionId: string | null;
  conversationHistory: Record<string, ConversationMessage[]>;
  voiceState: VoiceInteractionState;
  liveTranscript: string;
  partialTranscript: string;
  voiceProvider: string;
  ttsEnabled: boolean;
  continuousMode: boolean;
  captionsEnabled: boolean;
  isSpeaking: boolean;
  volumeLevel: number;
  lastSyncAt: string | null;
  // Multi-agent conference state
  isConferenceMode: boolean;
  invitedAgentIds: string[];
  conferenceSession: OpenClawConferenceSession | null;
  conferenceParticipants: ConferenceParticipant[];
  activeSpeakerId: string | null;
  activeSpeakerAgentId: string | null;
  setHydrated: (value: boolean) => void;
  applyPersistedState: (state: PersistedAppState) => void;
  setGatewayContext: (payload: {
    gatewayUrl?: string;
    gatewayLabel?: string | null;
    authToken?: string | null;
    isMockMode?: boolean;
    connectionMethod?: 'auto' | 'manual' | 'qr' | 'mock';
  }) => void;
  setConnectionStatus: (
    status: GatewayConnectionStatus,
    error?: string | null,
  ) => void;
  setDiscoveredGateways: (gateways: GatewayCandidate[]) => void;
  setAgents: (agents: AgentSummary[]) => void;
  setSelectedAgentId: (agentId: string | null) => void;
  setSessions: (sessions: SessionSummary[]) => void;
  upsertSession: (session: SessionSummary) => void;
  setSelectedSessionId: (sessionId: string | null) => void;
  setConversationHistory: (
    sessionId: string,
    messages: ConversationMessage[],
  ) => void;
  appendMessage: (message: ConversationMessage) => void;
  setVoicePresentation: (payload: {
    voiceState?: VoiceInteractionState;
    liveTranscript?: string;
    partialTranscript?: string;
    voiceProvider?: string;
    isSpeaking?: boolean;
    volumeLevel?: number;
  }) => void;
  setContinuousMode: (value: boolean) => void;
  setTtsEnabled: (value: boolean) => void;
  setCaptionsEnabled: (value: boolean) => void;
  clearConnection: () => void;
  // Multi-agent conference actions
  setConferenceMode: (enabled: boolean) => void;
  setInvitedAgentIds: (agentIds: string[]) => void;
  toggleAgentInvitation: (agentId: string) => void;
  setConferenceSession: (session: OpenClawConferenceSession | null) => void;
  setConferenceParticipants: (participants: ConferenceParticipant[]) => void;
  updateParticipant: (
    identity: string,
    update: Partial<ConferenceParticipant>,
  ) => void;
  setActiveSpeaker: (
    speakerId: string | null,
    agentId?: string | null,
  ) => void;
  clearConference: () => void;
}

const defaultPersistedState = secureStorageService.getDefaultState();

export const useAppStore = create<AppStore>((set) => ({
  hydrated: false,
  gatewayUrl: defaultPersistedState.gatewayUrl,
  gatewayLabel: defaultPersistedState.gatewayLabel,
  authToken: defaultPersistedState.authToken,
  isMockMode: defaultPersistedState.isMockMode,
  connectionMethod: appEnv.enableMockMode ? 'mock' : 'manual',
  connectionStatus: 'unconfigured',
  connectionError: null,
  discoveredGateways: [],
  agents: [],
  selectedAgentId: defaultPersistedState.selectedAgentId,
  sessions: [],
  selectedSessionId: defaultPersistedState.selectedSessionId,
  conversationHistory: {},
  voiceState: 'idle',
  liveTranscript: '',
  partialTranscript: '',
  voiceProvider: 'initializing',
  ttsEnabled: defaultPersistedState.ttsEnabled,
  continuousMode: defaultPersistedState.continuousMode,
  captionsEnabled: defaultPersistedState.captionsEnabled,
  isSpeaking: false,
  volumeLevel: 0,
  lastSyncAt: null,
  // Multi-agent conference state defaults
  isConferenceMode: false,
  invitedAgentIds: [],
  conferenceSession: null,
  conferenceParticipants: [],
  activeSpeakerId: null,
  activeSpeakerAgentId: null,
  setHydrated: (value) => {
    set({
      hydrated: value,
    });
  },
  applyPersistedState: (state) => {
    set({
      gatewayUrl: state.gatewayUrl,
      gatewayLabel: state.gatewayLabel,
      authToken: state.authToken,
      selectedAgentId: state.selectedAgentId,
      selectedSessionId: state.selectedSessionId,
      isMockMode: state.isMockMode,
      continuousMode: state.continuousMode,
      ttsEnabled: state.ttsEnabled,
      captionsEnabled: state.captionsEnabled,
      connectionMethod: state.isMockMode ? 'mock' : 'manual',
      connectionStatus: state.authToken ? 'connected' : 'unconfigured',
    });
  },
  setGatewayContext: (payload) => {
    set((state) => ({
      gatewayUrl: payload.gatewayUrl ?? state.gatewayUrl,
      gatewayLabel:
        payload.gatewayLabel === undefined
          ? state.gatewayLabel
          : payload.gatewayLabel,
      authToken:
        payload.authToken === undefined ? state.authToken : payload.authToken,
      isMockMode:
        payload.isMockMode === undefined ? state.isMockMode : payload.isMockMode,
      connectionMethod:
        payload.connectionMethod ?? state.connectionMethod,
    }));
  },
  setConnectionStatus: (status, error = null) => {
    set({
      connectionStatus: status,
      connectionError: error,
      lastSyncAt: status === 'connected' ? new Date().toISOString() : null,
    });
  },
  setDiscoveredGateways: (gateways) => {
    set({
      discoveredGateways: gateways,
    });
  },
  setAgents: (agents) => {
    set({
      agents,
    });
  },
  setSelectedAgentId: (agentId) => {
    set({
      selectedAgentId: agentId,
      selectedSessionId: null,
      sessions: [],
    });
  },
  setSessions: (sessions) => {
    set({
      sessions,
    });
  },
  upsertSession: (session) => {
    set((state) => {
      const existing = state.sessions.find((entry) => entry.id === session.id);

      if (!existing) {
        return {
          sessions: [session, ...state.sessions],
        };
      }

      return {
        sessions: state.sessions.map((entry) =>
          entry.id === session.id ? session : entry,
        ),
      };
    });
  },
  setSelectedSessionId: (sessionId) => {
    set({
      selectedSessionId: sessionId,
    });
  },
  setConversationHistory: (sessionId, messages) => {
    set((state) => ({
      conversationHistory: {
        ...state.conversationHistory,
        [sessionId]: messages,
      },
    }));
  },
  appendMessage: (message) => {
    set((state) => {
      const current = state.conversationHistory[message.sessionId] ?? [];

      return {
        conversationHistory: {
          ...state.conversationHistory,
          [message.sessionId]: [...current, message],
        },
      };
    });
  },
  setVoicePresentation: (payload) => {
    set((state) => ({
      voiceState: payload.voiceState ?? state.voiceState,
      liveTranscript:
        payload.liveTranscript === undefined
          ? state.liveTranscript
          : payload.liveTranscript,
      partialTranscript:
        payload.partialTranscript === undefined
          ? state.partialTranscript
          : payload.partialTranscript,
      voiceProvider: payload.voiceProvider ?? state.voiceProvider,
      isSpeaking:
        payload.isSpeaking === undefined
          ? state.isSpeaking
          : payload.isSpeaking,
      volumeLevel:
        payload.volumeLevel === undefined
          ? state.volumeLevel
          : payload.volumeLevel,
    }));
  },
  setContinuousMode: (value) => {
    set({
      continuousMode: value,
    });
  },
  setTtsEnabled: (value) => {
    set({
      ttsEnabled: value,
    });
  },
  setCaptionsEnabled: (value) => {
    set({
      captionsEnabled: value,
    });
  },
  clearConnection: () => {
    set({
      gatewayUrl: '',
      gatewayLabel: null,
      authToken: null,
      isMockMode: appEnv.enableMockMode,
      connectionMethod: appEnv.enableMockMode ? 'mock' : 'manual',
      connectionStatus: 'unconfigured',
      connectionError: null,
      discoveredGateways: [],
      agents: [],
      selectedAgentId: null,
      sessions: [],
      selectedSessionId: null,
      conversationHistory: {},
      voiceState: 'idle',
      liveTranscript: '',
      partialTranscript: '',
      voiceProvider: 'initializing',
      ttsEnabled: true,
      continuousMode: true,
      captionsEnabled: false,
      isSpeaking: false,
      volumeLevel: 0,
      lastSyncAt: null,
      // Also clear conference state
      isConferenceMode: false,
      invitedAgentIds: [],
      conferenceSession: null,
      conferenceParticipants: [],
      activeSpeakerId: null,
      activeSpeakerAgentId: null,
    });
  },
  // Multi-agent conference actions
  setConferenceMode: (enabled) => {
    set({ isConferenceMode: enabled });
  },
  setInvitedAgentIds: (agentIds) => {
    set({ invitedAgentIds: agentIds });
  },
  toggleAgentInvitation: (agentId) => {
    set((state) => {
      const current = state.invitedAgentIds;
      const isInvited = current.includes(agentId);
      return {
        invitedAgentIds: isInvited
          ? current.filter((id) => id !== agentId)
          : [...current, agentId],
      };
    });
  },
  setConferenceSession: (session) => {
    set({ conferenceSession: session });
  },
  setConferenceParticipants: (participants) => {
    set({ conferenceParticipants: participants });
  },
  updateParticipant: (identity, update) => {
    set((state) => ({
      conferenceParticipants: state.conferenceParticipants.map((p) =>
        p.identity === identity ? { ...p, ...update } : p,
      ),
    }));
  },
  setActiveSpeaker: (speakerId, agentId = null) => {
    set({
      activeSpeakerId: speakerId,
      activeSpeakerAgentId: agentId,
    });
  },
  clearConference: () => {
    set({
      isConferenceMode: false,
      invitedAgentIds: [],
      conferenceSession: null,
      conferenceParticipants: [],
      activeSpeakerId: null,
      activeSpeakerAgentId: null,
    });
  },
}));
