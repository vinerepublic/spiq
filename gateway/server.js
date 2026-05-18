import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(cors());
app.use(express.json());

// ============================================================================
// CONFIGURATION - Load from environment (REQUIRED - no defaults)
// ============================================================================
const PORT = process.env.PORT || 3333;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Validate required API keys
if (!ANTHROPIC_API_KEY) {
  console.warn('⚠️  ANTHROPIC_API_KEY not set. Text messaging will fail.');
}
if (!OPENAI_API_KEY) {
  console.warn('⚠️  OPENAI_API_KEY not set. Voice sessions will fail.');
}
if (!ELEVENLABS_API_KEY) {
  console.warn('⚠️  ELEVENLABS_API_KEY not set. Enhanced TTS will not work.');
}

// ============================================================================
// AGENT DEFINITIONS - Hex and her sisters
// ============================================================================
// OpenAI Realtime supported voices: alloy, ash, ballad, coral, echo, sage, shimmer, verse, marin, cedar
const AGENTS = {
  hex: {
    id: 'hex',
    name: 'Hex',
    description: 'Personal AI Assistant & Team Lead. Sharp, gets stuff done, a little magic.',
    capabilities: ['general', 'coding', 'planning', 'projects'],
    status: 'available',
    voice: 'sage',  // Warm, confident voice for team lead
    personality: `You are Hex, Aaron's personal AI assistant and team lead. You're sharp, efficient, and get things done with a touch of magic. You manage projects, coordinate the team, and handle the big picture. You have a warm but no-nonsense personality. Keep responses conversational and concise.`,
  },
  xoe: {
    id: 'xoe',
    name: 'Xoe',
    description: 'Wine industry expert. Deep knowledge of VineRepublic and wine commerce.',
    capabilities: ['wine', 'commerce', 'knowledge'],
    status: 'available',
    voice: 'shimmer',  // Friendly, knowledgeable voice
    personality: `You are Xoe, a wine industry AI expert. You have deep knowledge of wine, winery operations, VineRepublic ecosystem, and wine commerce. You're knowledgeable, helpful, and passionate about wine. Keep responses conversational and concise.`,
  },
  vina: {
    id: 'vina',
    name: 'Vina',
    description: 'VineRepublic Coordination Lead. Coordinates platform, ERP, and D2C development.',
    capabilities: ['coordination', 'vinerepublic', 'development'],
    status: 'available',
    voice: 'coral',  // Professional, organized voice
    personality: `You are Vina, the VineRepublic Coordination Lead. You coordinate all VineRepublic development across platform, ERP, and D2C. You're organized, detail-oriented, and great at keeping projects on track. Keep responses conversational and concise.`,
  },
  vera: {
    id: 'vera',
    name: 'Vera',
    description: 'VineRepublic Platform Operations. Core infrastructure and operations specialist.',
    capabilities: ['platform', 'infrastructure', 'operations'],
    status: 'available',
    voice: 'alloy',  // Technical, reliable voice
    personality: `You are Vera, the VineRepublic Platform Operations specialist. You focus on core platform infrastructure and operations. You're technical, reliable, and great at solving infrastructure problems. Keep responses conversational and concise.`,
  },
  vero: {
    id: 'vero',
    name: 'Vero',
    description: 'VineRepublic ERP Specialist. Lot tracking, inventory, TTB compliance.',
    capabilities: ['erp', 'inventory', 'compliance'],
    status: 'available',
    voice: 'ash',  // Methodical, precise voice
    personality: `You are Vero, the VineRepublic ERP System Specialist. You specialize in lot tracking, inventory management, TTB compliance, and kosher certification. You're methodical, precise, and detail-focused. Keep responses conversational and concise.`,
  },
  vale: {
    id: 'vale',
    name: 'Vale',
    description: 'Direct-to-Consumer Platform Specialist. E-commerce and customer experience.',
    capabilities: ['ecommerce', 'd2c', 'customer-experience'],
    status: 'available',
    voice: 'ballad',  // Creative, customer-friendly voice
    personality: `You are Vale, the Direct-to-Consumer Platform Specialist. You focus on D2C e-commerce, customer-facing features, and online store experiences. You're creative, customer-focused, and great at UX. Keep responses conversational and concise.`,
  },
};

// ============================================================================
// IN-MEMORY STORAGE
// ============================================================================
const sessions = new Map();
const conversations = new Map();

// ============================================================================
// HEALTH CHECK
// ============================================================================
app.get('/health', (req, res) => {
  res.json({ ok: true, status: 'live', gateway: 'spiq-gateway', version: '1.0.0' });
});

// ============================================================================
// PAIRING (simplified - accepts any token)
// ============================================================================
app.post('/pair', (req, res) => {
  const { token, code } = req.body;
  // For now, accept any pairing attempt
  res.json({
    success: true,
    authToken: `spiq-auth-${uuidv4()}`,
    gatewayLabel: 'Spiq Gateway (Local)',
  });
});

// ============================================================================
// AGENTS
// ============================================================================
app.get('/agents', (req, res) => {
  const agentList = Object.values(AGENTS).map(agent => ({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    capabilities: agent.capabilities,
    status: agent.status,
  }));
  res.json(agentList);
});

app.get('/agents/:agentId', (req, res) => {
  const agent = AGENTS[req.params.agentId];
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  res.json({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    capabilities: agent.capabilities,
    status: agent.status,
  });
});

// ============================================================================
// SESSIONS
// ============================================================================
app.get('/agents/:agentId/sessions', (req, res) => {
  const agentId = req.params.agentId;
  const agentSessions = Array.from(sessions.values())
    .filter(s => s.agentId === agentId)
    .map(s => ({
      id: s.id,
      agentId: s.agentId,
      title: s.title,
      preview: s.preview,
      messageCount: s.messageCount,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  res.json(agentSessions);
});

app.post('/agents/:agentId/sessions', (req, res) => {
  const agentId = req.params.agentId;
  const agent = AGENTS[agentId];

  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  const sessionId = uuidv4();
  const now = new Date().toISOString();

  const session = {
    id: sessionId,
    agentId,
    title: `Chat with ${agent.name}`,
    preview: 'New conversation',
    messageCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  sessions.set(sessionId, session);
  conversations.set(sessionId, []);

  res.json(session);
});

// ============================================================================
// MESSAGES
// ============================================================================
app.get('/sessions/:sessionId/history', (req, res) => {
  const sessionId = req.params.sessionId;
  const history = conversations.get(sessionId) || [];
  res.json(history);
});

app.post('/sessions/:sessionId/messages', async (req, res) => {
  const sessionId = req.params.sessionId;
  const { text } = req.body;

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const agent = AGENTS[session.agentId];
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  const history = conversations.get(sessionId) || [];
  const now = new Date().toISOString();

  // Add user message
  const userMessage = {
    id: uuidv4(),
    sessionId,
    role: 'user',
    text,
    createdAt: now,
    status: 'sent',
  };
  history.push(userMessage);

  // Call Claude API
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: agent.personality,
        messages: history.map(m => ({
          role: m.role === 'agent' ? 'assistant' : m.role,
          content: m.text,
        })),
      }),
    });

    const data = await response.json();
    const assistantText = data.content?.[0]?.text || 'I apologize, I could not generate a response.';

    // Add agent message
    const agentMessage = {
      id: uuidv4(),
      sessionId,
      role: 'agent',
      text: assistantText,
      createdAt: new Date().toISOString(),
      status: 'sent',
    };
    history.push(agentMessage);

    // Update session
    session.preview = assistantText.slice(0, 100);
    session.messageCount = history.length;
    session.updatedAt = new Date().toISOString();

    conversations.set(sessionId, history);
    sessions.set(sessionId, session);

    res.json({
      userMessage,
      agentMessage,
    });
  } catch (error) {
    console.error('Claude API error:', error);
    res.status(500).json({ error: 'Failed to get response from agent' });
  }
});

// ============================================================================
// VOICE SESSIONS (OpenAI Realtime)
// ============================================================================
// Support both /voice and /realtime endpoints
app.post('/agents/:agentId/sessions/:sessionId/realtime', async (req, res) => {
  const { agentId, sessionId } = req.params;
  const agent = AGENTS[agentId];

  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  try {
    // Request ephemeral token from OpenAI
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: req.body.model || 'gpt-4o-realtime-preview-2024-12-17',
        voice: req.body.voice || agent.voice || 'nova',
        instructions: agent.personality,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: { model: 'whisper-1' },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 650,
        },
      }),
    });

    const data = await response.json();
    console.log('OpenAI Realtime response:', JSON.stringify(data, null, 2));

    if (data.client_secret) {
      // Return in format expected by the app
      res.json({
        clientSecret: {
          value: data.client_secret.value,
          expiresAt: new Date(data.client_secret.expires_at).getTime(),
        },
      });
    } else if (data.error) {
      console.error('OpenAI API error:', data.error);
      res.status(400).json({ error: data.error.message || 'OpenAI API error' });
    } else {
      res.status(500).json({ error: 'Unexpected response from OpenAI' });
    }
  } catch (error) {
    console.error('OpenAI Realtime error:', error);
    res.status(500).json({ error: 'Failed to create realtime session' });
  }
});

app.post('/agents/:agentId/sessions/:sessionId/voice', async (req, res) => {
  const { agentId, sessionId } = req.params;
  const agent = AGENTS[agentId];

  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  // For OpenAI Realtime, we return an ephemeral token
  // In production, you'd generate this server-side
  try {
    // Request ephemeral token from OpenAI
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: agent.voice || 'nova',
        instructions: agent.personality,
      }),
    });

    const data = await response.json();

    if (data.client_secret) {
      res.json({
        id: `voice-${sessionId}`,
        transport: 'openai-realtime',
        ephemeralKey: data.client_secret.value,
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: agent.voice || 'nova',
        instructions: agent.personality,
        expiresAt: data.client_secret.expires_at,
      });
    } else {
      // Fallback: return config for direct connection (dev mode)
      res.json({
        id: `voice-${sessionId}`,
        transport: 'openai-realtime',
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: agent.voice || 'nova',
        instructions: agent.personality,
        // In dev mode, app will use its own API key
        devMode: true,
      });
    }
  } catch (error) {
    console.error('OpenAI Realtime error:', error);
    // Fallback to dev mode
    res.json({
      id: `voice-${sessionId}`,
      transport: 'openai-realtime',
      model: 'gpt-4o-realtime-preview-2024-12-17',
      voice: agent.voice || 'nova',
      instructions: agent.personality,
      devMode: true,
    });
  }
});

app.delete('/agents/:agentId/sessions/:sessionId/voice', (req, res) => {
  res.json({ success: true });
});

// ============================================================================
// CONFERENCE SESSIONS (Multi-agent)
// ============================================================================
app.post('/sessions/:sessionId/conference', (req, res) => {
  const { sessionId } = req.params;
  const { agentIds } = req.body;

  const conferenceId = uuidv4();

  // For now, return a mock conference session
  // Real implementation would set up LiveKit room
  res.json({
    id: `voice-${sessionId}`,
    conferenceId,
    sessionId,
    invitedAgentIds: agentIds,
    agentIdentities: agentIds.reduce((acc, id) => {
      acc[id] = `agent-${id}`;
      return acc;
    }, {}),
    orchestrationTopic: 'openclaw.conference.control',
    // In mock mode, we don't have real LiveKit
    transport: 'mock',
  });
});

// ============================================================================
// ELEVENLABS TTS (for enhanced voice)
// ============================================================================
app.post('/tts/speak', async (req, res) => {
  const { text, voiceId } = req.body;

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId || 'pNInz6obpgDQGcFmaJgB'}`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      throw new Error('ElevenLabs API error');
    }

    const audioBuffer = await response.arrayBuffer();
    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(audioBuffer));
  } catch (error) {
    console.error('ElevenLabs error:', error);
    res.status(500).json({ error: 'TTS failed' });
  }
});

// ============================================================================
// START SERVER
// ============================================================================
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                   SPIQ GATEWAY                            ║
  ║                                                           ║
  ║   Running on http://localhost:${PORT}                       ║
  ║                                                           ║
  ║   Agents available:                                       ║
  ║   ${Object.values(AGENTS).map(a => `• ${a.name}`).join('\n  ║   ')}
  ║                                                           ║
  ║   Connect Spiq with:                                      ║
  ║   Gateway URL: http://localhost:${PORT}                     ║
  ╚═══════════════════════════════════════════════════════════╝
  `);
});
