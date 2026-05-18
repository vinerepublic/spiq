import { appEnv, type SpeechProviderPreference } from '../config/env';
import type { VoiceInteractionState } from '../types/app';
import { wait } from '../utils/gateway';

interface SpeechRecognitionOptions {
  continuous: boolean;
  language?: string;
}

interface VoiceInputEventHandlers {
  onStateChange?: (state: VoiceInteractionState) => void;
  onPartialTranscript?: (text: string) => void;
  onFinalTranscript?: (text: string) => void;
  onError?: (message: string) => void;
  onVolumeChange?: (value: number) => void;
}

interface SpeechToTextProvider {
  readonly name: string;
  readonly supportsNativeRecognition: boolean;
  subscribe(handlers: VoiceInputEventHandlers): () => void;
  requestPermissions(): Promise<boolean>;
  startListening(options: SpeechRecognitionOptions): Promise<void>;
  stopListening(): Promise<void>;
  abortListening(): Promise<void>;
  isAvailable(): boolean;
}

type ExpoSpeechRecognitionModuleLike = {
  requestPermissionsAsync(): Promise<{ granted: boolean }>;
  start(options: Record<string, unknown>): void;
  stop(): void;
  abort(): void;
  isRecognitionAvailable?(): boolean;
  addListener(
    eventName: string,
    listener: (event: any) => void,
  ): {
    remove(): void;
  };
};

const tryLoadSpeechRecognition = () => {
  try {
    const module = require('expo-speech-recognition') as {
      ExpoSpeechRecognitionModule: ExpoSpeechRecognitionModuleLike;
    };

    return module.ExpoSpeechRecognitionModule;
  } catch {
    return null;
  }
};

class MockSpeechToTextProvider implements SpeechToTextProvider {
  readonly name = 'mock';
  readonly supportsNativeRecognition = false;

  private handlers: VoiceInputEventHandlers = {};
  private running = false;
  private currentTranscript = '';
  private samplePhrases = [
    'Give me a short status update on the selected OpenClaw agent.',
    'Create a new session and summarize the last deployment.',
    'What should I check if the gateway is offline?',
  ];
  private sampleIndex = 0;

  subscribe(handlers: VoiceInputEventHandlers) {
    this.handlers = handlers;

    return () => {
      this.handlers = {};
    };
  }

  async requestPermissions() {
    return true;
  }

  async startListening() {
    this.running = true;
    this.currentTranscript = this.samplePhrases[this.sampleIndex];
    this.sampleIndex = (this.sampleIndex + 1) % this.samplePhrases.length;
    this.handlers.onStateChange?.('listening');

    await wait(350);

    if (!this.running) {
      return;
    }

    const midpoint = Math.max(10, Math.floor(this.currentTranscript.length / 2));
    this.handlers.onPartialTranscript?.(this.currentTranscript.slice(0, midpoint));
    this.handlers.onVolumeChange?.(6);
  }

  async stopListening() {
    if (!this.running) {
      return;
    }

    this.running = false;
    this.handlers.onStateChange?.('processing');
    await wait(250);
    this.handlers.onFinalTranscript?.(this.currentTranscript);
    this.handlers.onVolumeChange?.(0);
    this.handlers.onStateChange?.('idle');
  }

  async abortListening() {
    this.running = false;
    this.handlers.onVolumeChange?.(0);
    this.handlers.onStateChange?.('idle');
  }

  isAvailable() {
    return true;
  }
}

class ExpoSpeechRecognitionProvider implements SpeechToTextProvider {
  readonly name = 'expo-speech-recognition';
  readonly supportsNativeRecognition = true;

  private handlers: VoiceInputEventHandlers = {};
  private subscriptions: Array<{ remove(): void }> = [];
  private module: ExpoSpeechRecognitionModuleLike | null;

  constructor() {
    this.module = tryLoadSpeechRecognition();
  }

  subscribe(handlers: VoiceInputEventHandlers) {
    this.handlers = handlers;
    this.cleanup();

    if (!this.module) {
      return () => undefined;
    }

    this.subscriptions = [
      this.module.addListener('start', () => {
        this.handlers.onStateChange?.('listening');
      }),
      this.module.addListener('end', () => {
        this.handlers.onStateChange?.('idle');
        this.handlers.onVolumeChange?.(0);
      }),
      this.module.addListener('result', (event: { isFinal: boolean; results: Array<{ transcript: string }> }) => {
        const transcript = event.results[0]?.transcript?.trim();

        if (!transcript) {
          return;
        }

        if (event.isFinal) {
          this.handlers.onFinalTranscript?.(transcript);
        } else {
          this.handlers.onPartialTranscript?.(transcript);
        }
      }),
      this.module.addListener('error', (event: { error: string; message: string }) => {
        if (event.error === 'aborted') {
          this.handlers.onStateChange?.('idle');
          return;
        }

        this.handlers.onStateChange?.('error');
        this.handlers.onError?.(event.message);
      }),
      this.module.addListener('volumechange', (event: { value: number }) => {
        this.handlers.onVolumeChange?.(event.value);
      }),
    ];

    return () => {
      this.cleanup();
      this.handlers = {};
    };
  }

  async requestPermissions() {
    if (!this.module) {
      return false;
    }

    const result = await this.module.requestPermissionsAsync();
    return result.granted;
  }

  async startListening(options: SpeechRecognitionOptions) {
    if (!this.module) {
      throw new Error('Native speech recognition is unavailable in this build.');
    }

    this.module.start({
      lang: options.language ?? 'en-US',
      interimResults: true,
      continuous: options.continuous,
      addsPunctuation: true,
      maxAlternatives: 1,
      androidIntentOptions: {
        EXTRA_LANGUAGE_MODEL: 'free_form',
      },
      volumeChangeEventOptions: {
        enabled: true,
        intervalMillis: 120,
      },
    });
  }

  async stopListening() {
    this.handlers.onStateChange?.('processing');
    this.module?.stop();
  }

  async abortListening() {
    this.module?.abort();
    this.handlers.onStateChange?.('idle');
  }

  isAvailable() {
    return this.module?.isRecognitionAvailable?.() ?? Boolean(this.module);
  }

  private cleanup() {
    this.subscriptions.forEach((subscription) => subscription.remove());
    this.subscriptions = [];
  }
}

class VoiceInputService {
  private provider: SpeechToTextProvider;

  constructor(preference: SpeechProviderPreference = appEnv.sttProvider) {
    const nativeProvider = new ExpoSpeechRecognitionProvider();

    if (preference === 'mock') {
      this.provider = new MockSpeechToTextProvider();
      return;
    }

    if (preference === 'expo') {
      this.provider = nativeProvider.isAvailable()
        ? nativeProvider
        : new MockSpeechToTextProvider();
      return;
    }

    this.provider = nativeProvider.isAvailable()
      ? nativeProvider
      : new MockSpeechToTextProvider();
  }

  get providerName() {
    return this.provider.name;
  }

  get isUsingMockProvider() {
    return this.provider.name === 'mock';
  }

  subscribe(handlers: VoiceInputEventHandlers) {
    return this.provider.subscribe(handlers);
  }

  requestPermissions() {
    return this.provider.requestPermissions();
  }

  startListening(options: SpeechRecognitionOptions) {
    return this.provider.startListening(options);
  }

  stopListening() {
    return this.provider.stopListening();
  }

  abortListening() {
    return this.provider.abortListening();
  }
}

export const voiceInputService = new VoiceInputService();
