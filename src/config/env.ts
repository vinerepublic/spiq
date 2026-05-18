type SpeechProviderPreference = 'auto' | 'expo' | 'mock';
type TtsProviderPreference = 'expo';
type VoiceTransportPreference = 'legacy' | 'livekit' | 'openai-realtime';
type ReasoningEffortPreference = 'low' | 'medium' | 'high';

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) {
    return fallback;
  }

  return value.toLowerCase() === 'true';
};

export const appEnv = {
  defaultGatewayUrl: process.env.EXPO_PUBLIC_OPENCLAW_DEFAULT_GATEWAY_URL ?? '',
  enableMockMode: parseBoolean(
    process.env.EXPO_PUBLIC_OPENCLAW_ENABLE_MOCK_MODE,
    true,
  ),
  voiceTransport:
    (process.env.EXPO_PUBLIC_OPENCLAW_VOICE_TRANSPORT as
      | VoiceTransportPreference
      | undefined) ?? 'openai-realtime',
  sttProvider:
    (process.env.EXPO_PUBLIC_OPENCLAW_STT_PROVIDER as
      | SpeechProviderPreference
      | undefined) ?? 'auto',
  ttsProvider:
    (process.env.EXPO_PUBLIC_OPENCLAW_TTS_PROVIDER as
      | TtsProviderPreference
      | undefined) ?? 'expo',
  // OpenAI Realtime 2.0 settings
  openaiApiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '',
  openaiRealtimeModel:
    process.env.EXPO_PUBLIC_OPENAI_REALTIME_MODEL ?? 'gpt-realtime-2',
  openaiRealtimeVoice: process.env.EXPO_PUBLIC_OPENAI_REALTIME_VOICE ?? 'marin',
  openaiRealtimeReasoningEffort:
    (process.env.EXPO_PUBLIC_OPENAI_REALTIME_REASONING_EFFORT as
      | ReasoningEffortPreference
      | undefined) ?? 'low',
};

export type {
  SpeechProviderPreference,
  TtsProviderPreference,
  VoiceTransportPreference,
  ReasoningEffortPreference,
};
