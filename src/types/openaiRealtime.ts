/**
 * OpenAI Realtime API types for direct WebRTC connection
 */

export type OpenAIRealtimeState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'error'
  | 'disconnected';

export interface OpenAIRealtimeSession {
  id: string;
  clientSecret: {
    value: string;
    expiresAt: number;
  };
  model: string;
  voice: string;
}

export interface OpenAIRealtimeTranscript {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  final: boolean;
  timestamp: number;
}

export interface OpenAIRealtimeCallbacks {
  onStateChange?: (state: OpenAIRealtimeState) => void;
  onTranscript?: (transcript: OpenAIRealtimeTranscript) => void;
  onError?: (message: string) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

/**
 * Reasoning effort level for Realtime 2.0
 * - 'low': Fastest response, lowest token usage (recommended for most voice agents)
 * - 'medium': Balanced reasoning and latency
 * - 'high': Most thorough reasoning, higher latency and token usage
 */
export type OpenAIRealtimeReasoningEffort = 'low' | 'medium' | 'high';

export interface OpenAIRealtimeConfig {
  apiKey?: string;
  model?: string;
  voice?: string;
  instructions?: string;
  gatewayUrl?: string;
  agentId?: string;
  sessionId?: string;
  /** Reasoning effort for Realtime 2.0 (optional, defaults to 'low' for voice) */
  reasoningEffort?: OpenAIRealtimeReasoningEffort;
}

/**
 * OpenAI Realtime server events (supports both legacy and GA Realtime 2.0 event names)
 */
export type OpenAIRealtimeServerEvent =
  | { type: 'session.created'; session: Record<string, unknown> }
  | { type: 'session.updated'; session: Record<string, unknown> }
  | { type: 'input_audio_buffer.speech_started' }
  | { type: 'input_audio_buffer.speech_stopped' }
  | { type: 'input_audio_buffer.committed' }
  | { type: 'conversation.item.created'; item: Record<string, unknown> }
  | {
      type: 'conversation.item.input_audio_transcription.completed';
      transcript: string;
      item_id: string;
    }
  | { type: 'response.created'; response: Record<string, unknown> }
  | { type: 'response.output_item.added'; item: Record<string, unknown> }
  | { type: 'response.content_part.added'; part: Record<string, unknown> }
  // Legacy event names (pre-GA)
  | {
      type: 'response.audio_transcript.delta';
      delta: string;
      item_id: string;
    }
  | {
      type: 'response.audio_transcript.done';
      transcript: string;
      item_id: string;
    }
  | { type: 'response.audio.delta'; delta: string }
  | { type: 'response.audio.done' }
  // GA Realtime 2.0 event names
  | {
      type: 'response.output_audio_transcript.delta';
      delta: string;
      item_id: string;
    }
  | {
      type: 'response.output_audio_transcript.done';
      transcript: string;
      item_id: string;
    }
  | { type: 'response.output_audio.delta'; delta: string }
  | { type: 'response.output_audio.done' }
  | {
      type: 'response.output_text.delta';
      delta: string;
      item_id: string;
    }
  | {
      type: 'response.output_text.done';
      text: string;
      item_id: string;
    }
  | { type: 'response.done'; response: Record<string, unknown> }
  | {
      type: 'response.function_call_arguments.done';
      call_id: string;
      name: string;
      arguments: string;
    }
  | { type: 'error'; error: { message: string; type?: string; code?: string } }
  | { type: string; [key: string]: unknown };

/**
 * OpenAI Realtime client events
 */
export type OpenAIRealtimeClientEvent =
  | { type: 'session.update'; session: Record<string, unknown> }
  | { type: 'input_audio_buffer.append'; audio: string }
  | { type: 'input_audio_buffer.commit' }
  | { type: 'input_audio_buffer.clear' }
  | { type: 'response.create'; response?: Record<string, unknown> }
  | { type: 'response.cancel' }
  | {
      type: 'conversation.item.create';
      item: {
        type: 'function_call_output' | 'message';
        call_id?: string;
        output?: string;
        role?: 'user' | 'assistant';
        content?: Array<{ type: string; text?: string }>;
      };
    };
