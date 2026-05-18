import * as Speech from 'expo-speech';

export interface TextToSpeechCallbacks {
  onStart?: () => void;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: (message: string) => void;
}

class TextToSpeechService {
  async speak(text: string, callbacks: TextToSpeechCallbacks = {}) {
    await Speech.stop();

    return new Promise<void>((resolve, reject) => {
      Speech.speak(text, {
        rate: 0.95,
        pitch: 1,
        onStart: () => {
          callbacks.onStart?.();
        },
        onDone: () => {
          callbacks.onDone?.();
          resolve();
        },
        onStopped: () => {
          callbacks.onStopped?.();
          resolve();
        },
        onError: (error) => {
          callbacks.onError?.(error.message ?? 'Unable to play text-to-speech.');
          reject(new Error(error.message ?? 'Unable to play text-to-speech.'));
        },
      });
    });
  }

  async stop() {
    await Speech.stop();
  }

  async isSpeaking() {
    return Speech.isSpeakingAsync();
  }
}

export const textToSpeechService = new TextToSpeechService();
