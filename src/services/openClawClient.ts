import { gatewayDiscoveryService } from './gatewayDiscoveryService';

import type {
  AgentSummary,
  ConferenceParticipant,
  ConversationMessage,
  GatewayCandidate,
  GatewayHealth,
  GatewayPairingResult,
  SessionSummary,
} from '../types/app';
import type {
  ConferenceConfig,
  ConferenceControlMessage,
  OpenClawConferenceSession,
  OpenClawLiveVoiceSession,
} from '../types/realtime';
import {
  buildGatewayUrl,
  createId,
  fetchWithTimeout,
  normalizeGatewayUrl,
  wait,
} from '../utils/gateway';
import { logger } from '../utils/logger';
import {
  sanitizeUserMessage,
  validateAuthToken,
  validateGatewayUrl,
  validateId,
  validatePairingCode,
} from '../utils/validation';

interface OpenClawClientConfig {
  gatewayUrl: string;
  authToken?: string | null;
  isMockMode?: boolean;
}

export interface OpenClawClient {
  discoverGateway(): Promise<GatewayCandidate | null>;
  connectToGateway(gatewayUrl: string): Promise<GatewayHealth>;
  pairWithGateway(pairingCodeOrToken: string): Promise<GatewayPairingResult>;
  listAgents(): Promise<AgentSummary[]>;
  listSessions(agentId: string): Promise<SessionSummary[]>;
  createSession(agentId: string): Promise<SessionSummary>;
  sendMessage(
    sessionId: string,
    messageText: string,
  ): Promise<ConversationMessage>;
  createLiveVoiceSession(
    agentId: string,
    sessionId: string,
  ): Promise<OpenClawLiveVoiceSession>;
  endLiveVoiceSession(
    agentId: string,
    sessionId: string,
    liveSessionId?: string,
  ): Promise<void>;
  streamMessage(
    sessionId: string,
    messageText: string,
  ): AsyncGenerator<string, void, void>;
  receiveResponse(sessionId: string): Promise<ConversationMessage | null>;
  getConversationHistory(sessionId: string): Promise<ConversationMessage[]>;
  // Multi-agent conference methods
  createConferenceSession(
    agentIds: string[],
    sessionId: string,
    config?: ConferenceConfig,
  ): Promise<OpenClawConferenceSession>;
  addAgentToConference(
    conferenceId: string,
    agentId: string,
  ): Promise<ConferenceParticipant>;
  removeAgentFromConference(
    conferenceId: string,
    agentId: string,
  ): Promise<void>;
  sendConferenceControl(
    conferenceId: string,
    message: ConferenceControlMessage,
  ): Promise<void>;
  getConferenceParticipants(
    conferenceId: string,
  ): Promise<ConferenceParticipant[]>;
}

const mockAgents: AgentSummary[] = [
  {
    id: 'hex',
    name: 'Hex',
    description: 'A fast operator agent for command-driven troubleshooting.',
    status: 'available',
    capabilities: ['Command execution', 'Logs', 'Triage'],
    defaultSessionTitle: 'Hex voice session',
  },
  {
    id: 'atlas',
    name: 'Atlas',
    description: 'A planner agent for architecture, research, and decision support.',
    status: 'available',
    capabilities: ['Planning', 'Architecture', 'Research'],
    defaultSessionTitle: 'Atlas briefing',
  },
  {
    id: 'scout',
    name: 'Scout',
    description: 'A monitoring agent for status checks and operational follow-up.',
    status: 'busy',
    capabilities: ['Monitoring', 'Status', 'Follow-up'],
    defaultSessionTitle: 'Scout ops sync',
  },
];

const mockSessionsByAgent = new Map<string, SessionSummary[]>();
const mockMessagesBySession = new Map<string, ConversationMessage[]>();

const getAgentById = (agentId: string) => mockAgents.find((agent) => agent.id === agentId);

const ensureMockSeedData = () => {
  if (mockSessionsByAgent.size > 0) {
    return;
  }

  const seededSession: SessionSummary = {
    id: 'session-hex-welcome',
    agentId: 'hex',
    title: 'Hex welcome session',
    preview: 'Ready to sync with your Gateway and take a request.',
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    messageCount: 2,
  };

  mockSessionsByAgent.set('hex', [seededSession]);
  mockMessagesBySession.set('session-hex-welcome', [
    {
      id: createId('msg'),
      sessionId: seededSession.id,
      role: 'system',
      text: 'OpenClaw Mock Gateway connected. Voice session ready.',
      createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    },
    {
      id: createId('msg'),
      sessionId: seededSession.id,
      role: 'agent',
      text: 'Hex here. Ask for a deployment status, triage help, or a quick plan.',
      createdAt: new Date(Date.now() - 59 * 60 * 1000).toISOString(),
    },
  ]);
};

const createMockReply = (agentId: string, messageText: string) => {
  const normalized = messageText.trim();

  switch (agentId) {
    case 'hex':
      return `Hex responding. I heard: "${normalized}". In a real OpenClaw deployment this reply would come from your self-hosted agent through the Gateway API.`;
    case 'atlas':
      return `Atlas responding. I heard: "${normalized}". I would normally synthesize a plan from your OpenClaw workspace context here.`;
    case 'scout':
      return `Scout responding. I heard: "${normalized}". I would normally summarize system health, alerts, and follow-up actions here.`;
    default:
      return `OpenClaw mock agent responding to: "${normalized}".`;
  }
};

class MockOpenClawClient implements OpenClawClient {
  private gatewayUrl: string;

  constructor(config: OpenClawClientConfig) {
    this.gatewayUrl = config.gatewayUrl || 'mock://openclaw-gateway';
    ensureMockSeedData();
  }

  async discoverGateway() {
    return (
      (await gatewayDiscoveryService.discoverCandidates()).find(
        (candidate) => candidate.isMock,
      ) ?? null
    );
  }

  async connectToGateway() {
    await wait(350);

    return {
      status: 'ok',
      gatewayName: 'OpenClaw Mock Gateway',
      version: 'mock-1.0',
      message: `Connected to ${this.gatewayUrl}`,
    } as GatewayHealth;
  }

  async pairWithGateway() {
    await wait(300);

    return {
      token: 'mock-openclaw-token',
      gatewayLabel: 'OpenClaw Mock Gateway',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  async listAgents() {
    await wait(250);
    return mockAgents;
  }

  async listSessions(agentId: string) {
    await wait(250);
    return mockSessionsByAgent.get(agentId) ?? [];
  }

  async createSession(agentId: string) {
    await wait(250);
    const agent = getAgentById(agentId);

    if (!agent) {
      throw new Error('Agent not found in mock mode.');
    }

    const session: SessionSummary = {
      id: createId('session'),
      agentId,
      title: agent.defaultSessionTitle ?? `${agent.name} session`,
      preview: 'New voice session',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: 1,
    };

    const sessions = mockSessionsByAgent.get(agentId) ?? [];
    mockSessionsByAgent.set(agentId, [session, ...sessions]);
    mockMessagesBySession.set(session.id, [
      {
        id: createId('msg'),
        sessionId: session.id,
        role: 'system',
        text: `Session created for ${agent.name}.`,
        createdAt: new Date().toISOString(),
      },
    ]);

    return session;
  }

  async sendMessage(sessionId: string, messageText: string) {
    await wait(750);
    const messages = mockMessagesBySession.get(sessionId) ?? [];
    const session = [...mockSessionsByAgent.values()]
      .flat()
      .find((entry) => entry.id === sessionId);

    if (!session) {
      throw new Error('Session not found in mock mode.');
    }

    const userMessage: ConversationMessage = {
      id: createId('msg'),
      sessionId,
      role: 'user',
      text: messageText,
      createdAt: new Date().toISOString(),
      status: 'sent',
    };

    const agentMessage: ConversationMessage = {
      id: createId('msg'),
      sessionId,
      role: 'agent',
      text: createMockReply(session.agentId, messageText),
      createdAt: new Date(Date.now() + 600).toISOString(),
      status: 'sent',
    };

    mockMessagesBySession.set(sessionId, [...messages, userMessage, agentMessage]);

    const updatedSessions = (mockSessionsByAgent.get(session.agentId) ?? []).map((entry) =>
      entry.id === session.id
        ? {
            ...entry,
            preview: agentMessage.text,
            updatedAt: agentMessage.createdAt,
            messageCount: entry.messageCount + 2,
          }
        : entry,
    );

    mockSessionsByAgent.set(session.agentId, updatedSessions);
    return agentMessage;
  }

  async createLiveVoiceSession(
    agentId: string,
    sessionId: string,
  ): Promise<OpenClawLiveVoiceSession> {
    await wait(200);

    return {
      id: createId('voice'),
      sessionId,
      agentId,
      transport: 'livekit-room' as const,
      serverUrl: 'wss://mock.livekit.invalid',
      token: 'mock-livekit-token',
      roomName: 'mock-openclaw-room',
      participantIdentity: 'spiq-user',
      agentIdentity: `${agentId}-agent`,
      controlTopic: 'openclaw.control',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };
  }

  async endLiveVoiceSession() {
    await wait(120);
  }

  async *streamMessage(sessionId: string, messageText: string) {
    const response = await this.sendMessage(sessionId, messageText);
    const chunks = response.text.split(' ');
    let running = '';

    for (const chunk of chunks) {
      running = `${running} ${chunk}`.trim();
      await wait(100);
      yield running;
    }
  }

  async receiveResponse(sessionId: string) {
    const history = await this.getConversationHistory(sessionId);
    const reversed = [...history].reverse();
    return reversed.find((message) => message.role === 'agent') ?? null;
  }

  async getConversationHistory(sessionId: string) {
    await wait(250);
    return mockMessagesBySession.get(sessionId) ?? [];
  }

  // Multi-agent conference methods (mock implementation)
  async createConferenceSession(
    agentIds: string[],
    sessionId: string,
    config?: ConferenceConfig,
  ): Promise<OpenClawConferenceSession> {
    await wait(300);

    const conferenceId = createId('conf');
    const agentIdentities: Record<string, string> = {};

    for (const agentId of agentIds) {
      agentIdentities[agentId] = `${agentId}-agent-${createId('p')}`;
    }

    return {
      id: createId('voice'),
      conferenceId,
      sessionId,
      agentId: agentIds[0], // Primary agent for backwards compat
      invitedAgentIds: agentIds,
      agentIdentities,
      transport: 'livekit-room' as const,
      serverUrl: 'wss://mock.livekit.invalid',
      token: 'mock-conference-token',
      roomName: `mock-conference-${conferenceId}`,
      participantIdentity: 'spiq-user',
      orchestrationTopic: 'openclaw.conference.control',
      controlTopic: 'openclaw.control',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
  }

  async addAgentToConference(
    _conferenceId: string,
    agentId: string,
  ): Promise<ConferenceParticipant> {
    await wait(200);
    const agent = getAgentById(agentId);

    return {
      id: createId('p'),
      identity: `${agentId}-agent-${createId('p')}`,
      type: 'agent',
      agentId,
      name: agent?.name ?? agentId,
      status: 'active',
      isMuted: false,
      joinedAt: new Date().toISOString(),
    };
  }

  async removeAgentFromConference(
    _conferenceId: string,
    _agentId: string,
  ): Promise<void> {
    await wait(150);
  }

  async sendConferenceControl(
    _conferenceId: string,
    _message: ConferenceControlMessage,
  ): Promise<void> {
    await wait(50);
  }

  async getConferenceParticipants(
    _conferenceId: string,
  ): Promise<ConferenceParticipant[]> {
    await wait(200);
    // Return mock participants based on invited agents
    return mockAgents
      .filter((agent) => agent.status === 'available')
      .slice(0, 2)
      .map((agent) => ({
        id: createId('p'),
        identity: `${agent.id}-agent`,
        type: 'agent' as const,
        agentId: agent.id,
        name: agent.name,
        status: 'active' as const,
        isMuted: false,
        joinedAt: new Date().toISOString(),
      }));
  }
}

class HttpOpenClawClient implements OpenClawClient {
  private gatewayUrl: string;
  private authToken: string | null;

  constructor(config: OpenClawClientConfig) {
    this.gatewayUrl = normalizeGatewayUrl(config.gatewayUrl);
    this.authToken = config.authToken ?? null;
  }

  private getHeaders() {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(this.authToken
        ? {
            Authorization: `Bearer ${this.authToken}`,
          }
        : {}),
    };
  }

  private async request<T>(path: string, init: RequestInit = {}) {
    const url = buildGatewayUrl(this.gatewayUrl, path);
    const startTime = Date.now();

    try {
      logger.request(init.method || 'GET', url);

      const response = await fetchWithTimeout(
        url,
        {
          ...init,
          headers: {
            ...this.getHeaders(),
            ...(init.headers ?? {}),
          },
        },
        6000,
      );

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const message = await response.text();
        logger.error('Gateway request failed', {
          path,
          status: response.status,
          duration,
          message: message.slice(0, 200), // Truncate long error messages
        });
        throw new Error(
          message || `OpenClaw Gateway request failed for ${path}.`,
        );
      }

      logger.request(init.method || 'GET', url, {
        status: response.status,
        duration,
      });

      if (response.status === 204) {
        return null as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Gateway request error', {
        path,
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async discoverGateway() {
    return (await gatewayDiscoveryService.discoverCandidates())[0] ?? null;
  }

  async connectToGateway(gatewayUrl: string) {
    // Validate Gateway URL
    const validation = validateGatewayUrl(gatewayUrl);
    if (!validation.valid) {
      logger.error('Invalid gateway URL', { url: gatewayUrl, error: validation.error });
      throw new Error(validation.error || 'Invalid gateway URL');
    }

    this.gatewayUrl = normalizeGatewayUrl(gatewayUrl);
    logger.info('Connecting to gateway', { url: this.gatewayUrl });

    return this.request<GatewayHealth>('/health', {
      method: 'GET',
    });
  }

  async pairWithGateway(pairingCodeOrToken: string) {
    // Validate pairing code
    const validation = validatePairingCode(pairingCodeOrToken);
    if (!validation.valid) {
      logger.error('Invalid pairing code', { error: validation.error });
      throw new Error(validation.error || 'Invalid pairing code');
    }

    logger.info('Pairing with gateway');

    const result = await this.request<GatewayPairingResult>('/pair', {
      method: 'POST',
      body: JSON.stringify({
        pairingCode: pairingCodeOrToken,
      }),
    });

    // Validate returned token
    if (result.token) {
      const tokenValidation = validateAuthToken(result.token);
      if (!tokenValidation.valid) {
        logger.error('Gateway returned invalid auth token');
        throw new Error('Gateway returned invalid authentication token');
      }
    }

    return result;
  }

  async listAgents() {
    logger.debug('Fetching agents list');

    const agents = await this.request<Array<Record<string, unknown>>>('/agents', {
      method: 'GET',
    });

    logger.info('Agents fetched', { count: agents.length });

    return agents.map((agent) => {
      const status: AgentSummary['status'] =
        agent.status === 'busy' || agent.status === 'offline'
          ? agent.status
          : 'available';

      return {
        id: String(agent.id),
        name: String(agent.name ?? agent.id ?? 'OpenClaw Agent'),
        description: String(
          agent.description ?? 'No description provided by the Gateway.',
        ),
        status,
        capabilities: Array.isArray(agent.capabilities)
          ? agent.capabilities.map(String)
          : ['Voice chat'],
        defaultSessionTitle: String(
          agent.defaultSessionTitle ?? `${agent.name ?? 'OpenClaw'} session`,
        ),
      };
    });
  }

  async listSessions(agentId: string) {
    // Validate agent ID
    const validation = validateId(agentId, 'agent');
    if (!validation.valid) {
      logger.error('Invalid agent ID', { agentId, error: validation.error });
      throw new Error(validation.error || 'Invalid agent ID');
    }

    logger.debug('Fetching sessions', { agentId });

    const sessions = await this.request<Array<Record<string, unknown>>>(
      `/agents/${agentId}/sessions`,
      {
        method: 'GET',
      },
    );

    logger.info('Sessions fetched', { agentId, count: sessions.length });

    return sessions.map((session) => ({
      id: String(session.id),
      agentId,
      title: String(session.title ?? 'Voice session'),
      preview: String(session.preview ?? 'No recent messages'),
      createdAt: String(session.createdAt ?? new Date().toISOString()),
      updatedAt: String(session.updatedAt ?? new Date().toISOString()),
      messageCount: Number(session.messageCount ?? 0),
    }));
  }

  async createSession(agentId: string) {
    // Validate agent ID
    const validation = validateId(agentId, 'agent');
    if (!validation.valid) {
      logger.error('Invalid agent ID', { agentId, error: validation.error });
      throw new Error(validation.error || 'Invalid agent ID');
    }

    logger.info('Creating session', { agentId });

    const session = await this.request<Record<string, unknown>>(
      `/agents/${agentId}/sessions`,
      {
        method: 'POST',
        body: JSON.stringify({
          source: 'mobile-voice-companion',
        }),
      },
    );

    const sessionId = String(session.id);
    logger.info('Session created', { agentId, sessionId });

    return {
      id: sessionId,
      agentId,
      title: String(session.title ?? 'New voice session'),
      preview: String(session.preview ?? 'Session created'),
      createdAt: String(session.createdAt ?? new Date().toISOString()),
      updatedAt: String(session.updatedAt ?? new Date().toISOString()),
      messageCount: Number(session.messageCount ?? 0),
    };
  }

  async sendMessage(sessionId: string, messageText: string) {
    // Validate session ID
    const sessionValidation = validateId(sessionId, 'session');
    if (!sessionValidation.valid) {
      logger.error('Invalid session ID', {
        sessionId,
        error: sessionValidation.error,
      });
      throw new Error(sessionValidation.error || 'Invalid session ID');
    }

    // Sanitize message text
    const sanitizedMessage = sanitizeUserMessage(messageText);
    if (!sanitizedMessage) {
      logger.error('Empty message after sanitization');
      throw new Error('Message cannot be empty');
    }

    logger.debug('Sending message', { sessionId, length: sanitizedMessage.length });

    const response = await this.request<Record<string, unknown>>(
      `/sessions/${sessionId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({
          message: sanitizedMessage,
        }),
      },
    );

    logger.info('Message sent and response received', { sessionId });

    return {
      id: String(response.id ?? createId('msg')),
      sessionId,
      role: 'agent' as const,
      text: String(
        response.reply ??
          response.response ??
          response.message ??
          'OpenClaw Gateway returned an empty response.',
      ),
      createdAt: String(response.createdAt ?? new Date().toISOString()),
      status: 'sent' as const,
    };
  }

  async createLiveVoiceSession(
    agentId: string,
    sessionId: string,
  ): Promise<OpenClawLiveVoiceSession> {
    // Validate IDs
    const agentValidation = validateId(agentId, 'agent');
    if (!agentValidation.valid) {
      logger.error('Invalid agent ID', { agentId, error: agentValidation.error });
      throw new Error(agentValidation.error || 'Invalid agent ID');
    }

    const sessionValidation = validateId(sessionId, 'session');
    if (!sessionValidation.valid) {
      logger.error('Invalid session ID', { sessionId, error: sessionValidation.error });
      throw new Error(sessionValidation.error || 'Invalid session ID');
    }

    logger.voice('Creating live voice session', { agentId, sessionId });

    const payload = await this.request<Record<string, unknown>>(
      `/agents/${agentId}/sessions/${sessionId}/voice`,
      {
        method: 'POST',
        body: JSON.stringify({
          client: 'spiq-mobile',
          transport: 'livekit-room',
          capabilities: {
            audio: true,
            transcriptions: true,
            interruptions: true,
          },
        }),
      },
    );

    const serverUrl = String(
      payload.serverUrl ?? payload.url ?? payload.wsUrl ?? '',
    ).trim();
    const token = String(payload.token ?? '').trim();

    if (!serverUrl || !token) {
      logger.error('Gateway returned incomplete voice session', { agentId, sessionId });
      throw new Error(
        'OpenClaw Gateway did not return a usable live voice session.',
      );
    }

    logger.voice('Live voice session created', { agentId, sessionId });

    return {
      id: String(payload.id ?? payload.voiceSessionId ?? createId('voice')),
      sessionId,
      agentId,
      transport: 'livekit-room' as const,
      serverUrl,
      token,
      roomName: String(payload.roomName ?? payload.room ?? 'openclaw-room'),
      participantIdentity:
        typeof payload.participantIdentity === 'string'
          ? payload.participantIdentity
          : undefined,
      agentIdentity:
        typeof payload.agentIdentity === 'string'
          ? payload.agentIdentity
          : undefined,
      controlTopic:
        typeof payload.controlTopic === 'string'
          ? payload.controlTopic
          : 'openclaw.control',
      expiresAt:
        typeof payload.expiresAt === 'string' ? payload.expiresAt : undefined,
    };
  }

  async endLiveVoiceSession(
    agentId: string,
    sessionId: string,
    liveSessionId?: string,
  ) {
    logger.voice('Ending live voice session', { agentId, sessionId, liveSessionId });

    await this.request<null>(`/agents/${agentId}/sessions/${sessionId}/voice`, {
      method: 'DELETE',
      body: JSON.stringify({
        liveSessionId,
      }),
    });

    logger.voice('Live voice session ended', { agentId, sessionId });
  }

  async *streamMessage(sessionId: string, messageText: string) {
    const response = await this.sendMessage(sessionId, messageText);
    yield response.text;
  }

  async receiveResponse(sessionId: string) {
    const history = await this.getConversationHistory(sessionId);
    return [...history].reverse().find((message) => message.role === 'agent') ?? null;
  }

  async getConversationHistory(sessionId: string) {
    // Validate session ID
    const validation = validateId(sessionId, 'session');
    if (!validation.valid) {
      logger.error('Invalid session ID', { sessionId, error: validation.error });
      throw new Error(validation.error || 'Invalid session ID');
    }

    logger.debug('Fetching conversation history', { sessionId });

    const history = await this.request<Array<Record<string, unknown>>>(
      `/sessions/${sessionId}/history`,
      {
        method: 'GET',
      },
    );

    logger.info('Conversation history fetched', { sessionId, count: history.length });

    return history.map((message) => {
      const role: ConversationMessage['role'] =
        message.role === 'user' || message.role === 'system'
          ? message.role
          : 'agent';

      return {
        id: String(message.id ?? createId('msg')),
        sessionId,
        role,
        text: String(message.text ?? message.message ?? ''),
        createdAt: String(message.createdAt ?? new Date().toISOString()),
        status: 'sent' as const,
      };
    });
  }

  // Multi-agent conference methods
  async createConferenceSession(
    agentIds: string[],
    sessionId: string,
    config?: ConferenceConfig,
  ): Promise<OpenClawConferenceSession> {
    // Validate session ID
    const sessionValidation = validateId(sessionId, 'session');
    if (!sessionValidation.valid) {
      logger.error('Invalid session ID', { sessionId, error: sessionValidation.error });
      throw new Error(sessionValidation.error || 'Invalid session ID');
    }

    // Validate agent IDs
    for (const agentId of agentIds) {
      const validation = validateId(agentId, 'agent');
      if (!validation.valid) {
        logger.error('Invalid agent ID in conference', { agentId, error: validation.error });
        throw new Error(`Invalid agent ID: ${agentId}`);
      }
    }

    if (agentIds.length < 2) {
      logger.error('Conference requires at least 2 agents', { count: agentIds.length });
      throw new Error('Conference requires at least 2 agents');
    }

    logger.voice('Creating conference session', { sessionId, agentCount: agentIds.length });

    const payload = await this.request<Record<string, unknown>>(
      `/sessions/${sessionId}/conference`,
      {
        method: 'POST',
        body: JSON.stringify({
          agentIds,
          client: 'spiq-mobile',
          transport: 'livekit-room',
          orchestrationMode: config?.orchestrationMode ?? 'gateway',
          enableAgentToAgent: config?.enableAgentToAgent ?? true,
          capabilities: {
            audio: true,
            transcriptions: true,
            interruptions: true,
            multiAgent: true,
          },
        }),
      },
    );

    const serverUrl = String(
      payload.serverUrl ?? payload.url ?? payload.wsUrl ?? '',
    ).trim();
    const token = String(payload.token ?? '').trim();

    if (!serverUrl || !token) {
      throw new Error(
        'OpenClaw Gateway did not return a usable conference session.',
      );
    }

    const agentIdentities: Record<string, string> = {};
    if (
      payload.agentIdentities &&
      typeof payload.agentIdentities === 'object'
    ) {
      for (const [key, value] of Object.entries(
        payload.agentIdentities as Record<string, unknown>,
      )) {
        agentIdentities[key] = String(value);
      }
    }

    const conferenceSession = {
      id: String(payload.id ?? createId('voice')),
      conferenceId: String(payload.conferenceId ?? createId('conf')),
      sessionId,
      agentId: agentIds[0],
      invitedAgentIds: agentIds,
      agentIdentities,
      transport: 'livekit-room' as const,
      serverUrl,
      token,
      roomName: String(payload.roomName ?? payload.room ?? 'openclaw-conference'),
      participantIdentity:
        typeof payload.participantIdentity === 'string'
          ? payload.participantIdentity
          : undefined,
      orchestrationTopic: String(
        payload.orchestrationTopic ?? 'openclaw.conference.control',
      ),
      controlTopic: String(payload.controlTopic ?? 'openclaw.control'),
      expiresAt:
        typeof payload.expiresAt === 'string' ? payload.expiresAt : undefined,
    };

    logger.voice('Conference session created', {
      sessionId,
      conferenceId: conferenceSession.conferenceId,
      agentCount: agentIds.length,
    });

    return conferenceSession;
  }

  async addAgentToConference(
    conferenceId: string,
    agentId: string,
  ): Promise<ConferenceParticipant> {
    const payload = await this.request<Record<string, unknown>>(
      `/conference/${conferenceId}/agents`,
      {
        method: 'POST',
        body: JSON.stringify({ agentId }),
      },
    );

    return {
      id: String(payload.id ?? createId('p')),
      identity: String(payload.identity ?? payload.participantIdentity ?? ''),
      type: 'agent',
      agentId,
      name: String(payload.name ?? agentId),
      status: 'active',
      isMuted: false,
      joinedAt: String(payload.joinedAt ?? new Date().toISOString()),
    };
  }

  async removeAgentFromConference(
    conferenceId: string,
    agentId: string,
  ): Promise<void> {
    await this.request<null>(`/conference/${conferenceId}/agents/${agentId}`, {
      method: 'DELETE',
    });
  }

  async sendConferenceControl(
    conferenceId: string,
    message: ConferenceControlMessage,
  ): Promise<void> {
    await this.request<null>(`/conference/${conferenceId}/control`, {
      method: 'POST',
      body: JSON.stringify(message),
    });
  }

  async getConferenceParticipants(
    conferenceId: string,
  ): Promise<ConferenceParticipant[]> {
    const participants = await this.request<Array<Record<string, unknown>>>(
      `/conference/${conferenceId}/participants`,
      { method: 'GET' },
    );

    return participants.map((p) => ({
      id: String(p.id ?? createId('p')),
      identity: String(p.identity ?? p.participantIdentity ?? ''),
      type: (p.type === 'user' ? 'user' : 'agent') as 'user' | 'agent',
      agentId: typeof p.agentId === 'string' ? p.agentId : undefined,
      name: String(p.name ?? p.agentId ?? 'Unknown'),
      status: (p.status as ConferenceParticipant['status']) ?? 'active',
      isMuted: Boolean(p.isMuted),
      joinedAt: typeof p.joinedAt === 'string' ? p.joinedAt : undefined,
    }));
  }
}

export const createOpenClawClient = (config: OpenClawClientConfig): OpenClawClient =>
  config.isMockMode ? new MockOpenClawClient(config) : new HttpOpenClawClient(config);
