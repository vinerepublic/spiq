/**
 * OpenAI Realtime Service
 * Direct WebRTC connection to OpenAI Realtime API for lowest latency voice AI
 */

import type {
  OpenAIRealtimeCallbacks,
  OpenAIRealtimeConfig,
  OpenAIRealtimeServerEvent,
  OpenAIRealtimeState,
  OpenAIRealtimeTranscript,
} from '../types/openaiRealtime';

/* eslint-disable @typescript-eslint/no-explicit-any */
type RTCPeerConnectionType = any;
type RTCDataChannelType = any;
type MediaStreamType = any;
/* eslint-enable @typescript-eslint/no-explicit-any */

interface RTCModule {
  RTCPeerConnection: new (config?: RTCConfiguration) => RTCPeerConnectionType;
  RTCSessionDescription: new (init: { type: string; sdp: string }) => RTCSessionDescriptionInit;
  mediaDevices: {
    getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStreamType>;
  };
}

const loadWebRTC = (): RTCModule => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@livekit/react-native-webrtc') as RTCModule;
  } catch {
    throw new Error(
      'OpenAI Realtime requires a native development build. Expo Go does not include WebRTC modules.',
    );
  }
};

const OPENAI_REALTIME_CALLS_URL = 'https://api.openai.com/v1/realtime/calls';
const OPENAI_CLIENT_SECRETS_URL = 'https://api.openai.com/v1/realtime/client_secrets';
const OPENAI_REALTIME_MODEL = 'gpt-realtime-2';

const DEFAULT_INSTRUCTIONS = `You are a helpful voice assistant. Keep responses concise and conversational.
- Speak naturally and be friendly
- Keep responses to 2-3 sentences unless more detail is requested
- Acknowledge requests before taking action`;

export class OpenAIRealtimeService {
  private peerConnection: RTCPeerConnectionType | null = null;
  private dataChannel: RTCDataChannelType | null = null;
  private localStream: MediaStreamType | null = null;
  private remoteStream: MediaStreamType | null = null;
  private callbacks: OpenAIRealtimeCallbacks = {};
  private state: OpenAIRealtimeState = 'idle';
  private config: OpenAIRealtimeConfig = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private partialTranscript = '';

  async connect(
    config: OpenAIRealtimeConfig,
    callbacks: OpenAIRealtimeCallbacks,
  ): Promise<void> {
    await this.disconnect();

    this.config = config;
    this.callbacks = callbacks;
    this.reconnectAttempts = 0;

    this.updateState('connecting');

    try {
      // Get ephemeral token
      const session = await this.getSessionToken();

      // Initialize WebRTC
      await this.initializeWebRTC(session.clientSecret.value);

      this.updateState('connected');
      this.callbacks.onConnected?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to connect';
      this.updateState('error');
      this.callbacks.onError?.(message);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.updateState('disconnected');

    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch {
        // Ignore close errors
      }
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch {
        // Ignore close errors
      }
      this.peerConnection = null;
    }

    if (this.localStream) {
      try {
        const tracks = this.localStream.getTracks();
        tracks.forEach((track: { stop: () => void }) => track.stop());
      } catch {
        // Ignore track stop errors
      }
      this.localStream = null;
    }

    this.remoteStream = null;
    this.partialTranscript = '';
    this.callbacks.onDisconnected?.();
  }

  interrupt(): void {
    if (this.state === 'speaking') {
      this.sendEvent({ type: 'response.cancel' });
      this.updateState('listening');
    }
  }

  sendTextMessage(text: string): void {
    this.sendEvent({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    });
    this.sendEvent({ type: 'response.create' });
  }

  getState(): OpenAIRealtimeState {
    return this.state;
  }

  getRemoteStream(): MediaStreamType | null {
    return this.remoteStream;
  }

  private async getSessionToken(): Promise<{
    clientSecret: { value: string; expiresAt: number };
  }> {
    // If gateway URL is provided, get token from gateway
    if (this.config.gatewayUrl) {
      const response = await fetch(
        `${this.config.gatewayUrl}/agents/${this.config.agentId}/sessions/${this.config.sessionId}/realtime`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.config.model || OPENAI_REALTIME_MODEL,
            voice: this.config.voice || 'alloy',
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to get session token: ${response.status}`);
      }

      return response.json();
    }

    // Direct API key mode (for development/testing)
    if (!this.config.apiKey) {
      throw new Error('Either gatewayUrl or apiKey must be provided');
    }

    // Build session config for OpenAI Realtime 2.0 GA API
    const sessionConfig = {
      session: {
        type: 'realtime',
        model: this.config.model || OPENAI_REALTIME_MODEL,
        instructions: this.config.instructions || DEFAULT_INSTRUCTIONS,
        audio: {
          input: {
            format: 'pcm16',
            transcription: { model: 'gpt-realtime-whisper' },
          },
          output: {
            format: 'pcm16',
            voice: this.config.voice || 'marin',
          },
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 650,
          create_response: true,
        },
        // Reasoning effort: 'low' for most production voice agents (lower latency)
        reasoning: this.config.reasoningEffort
          ? { effort: this.config.reasoningEffort }
          : undefined,
      },
    };

    const response = await fetch(OPENAI_CLIENT_SECRETS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sessionConfig),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create session: ${error}`);
    }

    const data = await response.json();
    return {
      clientSecret: {
        value: data.value,
        expiresAt: data.expires_at,
      },
    };
  }

  private async initializeWebRTC(token: string): Promise<void> {
    const WebRTC = loadWebRTC();
    const { RTCPeerConnection, RTCSessionDescription, mediaDevices } = WebRTC;

    // Get microphone access
    this.localStream = await mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    // Create peer connection
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    // Add audio track
    const audioTracks = this.localStream.getAudioTracks();
    if (audioTracks.length > 0) {
      this.peerConnection.addTrack(audioTracks[0], this.localStream);
    }

    // Handle incoming audio
    this.peerConnection.ontrack = (event: { streams: MediaStreamType[] }) => {
      console.log('[OpenAI Realtime] Received remote track');
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
      }
    };

    // Create data channel for events
    this.dataChannel = this.peerConnection.createDataChannel('oai-events');
    this.setupDataChannel();

    // Handle connection state
    this.peerConnection.onconnectionstatechange = () => {
      const connectionState = this.peerConnection?.connectionState;
      console.log('[OpenAI Realtime] Connection state:', connectionState);

      if (connectionState === 'disconnected' || connectionState === 'failed') {
        this.handleDisconnect();
      }
    };

    // Create and set local description
    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
    });
    await this.peerConnection.setLocalDescription(offer);

    // Send offer to OpenAI Realtime 2.0 /v1/realtime/calls endpoint
    const sdpResponse = await fetch(OPENAI_REALTIME_CALLS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/sdp',
      },
      body: offer.sdp,
    });

    if (!sdpResponse.ok) {
      throw new Error(`SDP exchange failed: ${sdpResponse.status}`);
    }

    const answerSdp = await sdpResponse.text();
    const answer = new RTCSessionDescription({ type: 'answer', sdp: answerSdp });
    await this.peerConnection.setRemoteDescription(answer);

    console.log('[OpenAI Realtime] WebRTC connection established');
  }

  private setupDataChannel(): void {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log('[OpenAI Realtime] Data channel open');
      this.updateState('listening');
    };

    this.dataChannel.onclose = () => {
      console.log('[OpenAI Realtime] Data channel closed');
    };

    this.dataChannel.onmessage = (event: { data: string }) => {
      try {
        const data = JSON.parse(event.data) as OpenAIRealtimeServerEvent;
        this.handleServerEvent(data);
      } catch (error) {
        console.error('[OpenAI Realtime] Failed to parse event:', error);
      }
    };
  }

  private handleServerEvent(event: OpenAIRealtimeServerEvent): void {
    // Skip verbose audio delta logs (both old and new event names)
    const isAudioDelta =
      event.type === 'response.audio.delta' ||
      event.type === 'response.output_audio.delta';
    if (!isAudioDelta) {
      console.log('[OpenAI Realtime 2.0] Event:', event.type);
    }

    switch (event.type) {
      case 'session.created':
        console.log('[OpenAI Realtime 2.0] Session created');
        this.updateState('listening');
        break;

      case 'input_audio_buffer.speech_started':
        console.log('[OpenAI Realtime 2.0] User started speaking');
        this.updateState('listening');
        break;

      case 'input_audio_buffer.speech_stopped':
        console.log('[OpenAI Realtime 2.0] User stopped speaking');
        this.updateState('processing');
        break;

      case 'conversation.item.input_audio_transcription.completed': {
        const typedEvent = event as {
          type: 'conversation.item.input_audio_transcription.completed';
          transcript: string;
          item_id: string;
        };
        const transcript = typedEvent.transcript || '';
        console.log('[OpenAI Realtime 2.0] User transcript:', transcript);
        this.emitTranscript({
          id: typedEvent.item_id || `user-${Date.now()}`,
          role: 'user',
          text: transcript,
          final: true,
          timestamp: Date.now(),
        });
        break;
      }

      case 'response.created':
        console.log('[OpenAI Realtime 2.0] Response started');
        this.updateState('processing');
        this.partialTranscript = '';
        break;

      // GA event names (Realtime 2.0)
      case 'response.output_audio_transcript.delta':
      // Legacy event name (for backwards compatibility)
      case 'response.audio_transcript.delta': {
        const typedEvent = event as {
          type: string;
          delta: string;
          item_id: string;
        };
        this.partialTranscript += typedEvent.delta || '';
        this.emitTranscript({
          id: typedEvent.item_id || `assistant-${Date.now()}`,
          role: 'assistant',
          text: this.partialTranscript,
          final: false,
          timestamp: Date.now(),
        });
        break;
      }

      // GA event names (Realtime 2.0)
      case 'response.output_audio_transcript.done':
      // Legacy event name (for backwards compatibility)
      case 'response.audio_transcript.done': {
        const typedEvent = event as {
          type: string;
          transcript: string;
          item_id: string;
        };
        const transcript = typedEvent.transcript || '';
        console.log('[OpenAI Realtime 2.0] Assistant transcript:', transcript);
        this.emitTranscript({
          id: typedEvent.item_id || `assistant-${Date.now()}`,
          role: 'assistant',
          text: transcript,
          final: true,
          timestamp: Date.now(),
        });
        this.partialTranscript = '';
        break;
      }

      // GA event names (Realtime 2.0)
      case 'response.output_audio.delta':
      // Legacy event name
      case 'response.audio.delta':
        if (this.state !== 'speaking') {
          this.updateState('speaking');
        }
        break;

      // GA event names (Realtime 2.0)
      case 'response.output_audio.done':
      // Legacy event name
      case 'response.audio.done':
        console.log('[OpenAI Realtime 2.0] Audio complete');
        break;

      case 'response.done':
        console.log('[OpenAI Realtime 2.0] Response complete');
        this.updateState('listening');
        break;

      case 'error': {
        const typedEvent = event as {
          type: 'error';
          error: { message: string; type?: string; code?: string };
        };
        const errorMessage = typedEvent.error?.message || 'Unknown error';
        console.error('[OpenAI Realtime 2.0] Error:', errorMessage);
        this.callbacks.onError?.(errorMessage);
        break;
      }
    }
  }

  private handleDisconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = 1000 * this.reconnectAttempts;
      console.log(
        `[OpenAI Realtime] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`,
      );

      setTimeout(() => {
        this.connect(this.config, this.callbacks).catch((error) => {
          console.error('[OpenAI Realtime] Reconnect failed:', error);
        });
      }, delay);
    } else {
      this.updateState('disconnected');
      this.callbacks.onDisconnected?.();
    }
  }

  private sendEvent(event: Record<string, unknown>): void {
    if (this.dataChannel?.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(event));
    }
  }

  private updateState(state: OpenAIRealtimeState): void {
    this.state = state;
    this.callbacks.onStateChange?.(state);
  }

  private emitTranscript(transcript: OpenAIRealtimeTranscript): void {
    this.callbacks.onTranscript?.(transcript);
  }
}

export const createOpenAIRealtimeService = () => new OpenAIRealtimeService();
