import type { ConfigContext, ExpoConfig } from 'expo/config';

const APP_NAME = 'Spiq';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP_NAME,
  slug: 'spiq',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  scheme: 'spiq',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#06131b',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.spiq.app',
    config: {
      usesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.spiq.app',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#06131b',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-dev-client',
    '@livekit/react-native-expo-plugin',
    '@config-plugins/react-native-webrtc',
    [
      'expo-audio',
      {
        microphonePermission:
          'Allow Spiq to access your microphone for voice conversations with your OpenClaw agents.',
        recordAudioAndroid: true,
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'Allow Spiq to access your camera to scan OpenClaw Gateway pairing QR codes.',
        microphonePermission:
          'Allow Spiq to access your microphone for QR pairing and voice conversations.',
        recordAudioAndroid: true,
      },
    ],
    [
      'expo-speech-recognition',
      {
        microphonePermission:
          'Allow Spiq to access your microphone for voice conversations with your OpenClaw agents.',
        speechRecognitionPermission:
          'Allow Spiq to convert your speech into messages for your OpenClaw agents.',
        androidSpeechServicePackages: ['com.google.android.googlequicksearchbox'],
      },
    ],
    'expo-secure-store',
  ],
  extra: {
    defaultGatewayUrl:
      process.env.EXPO_PUBLIC_OPENCLAW_DEFAULT_GATEWAY_URL ?? '',
    enableMockMode:
      process.env.EXPO_PUBLIC_OPENCLAW_ENABLE_MOCK_MODE ?? 'true',
    voiceTransport:
      process.env.EXPO_PUBLIC_OPENCLAW_VOICE_TRANSPORT ?? 'livekit',
    sttProvider: process.env.EXPO_PUBLIC_OPENCLAW_STT_PROVIDER ?? 'auto',
    ttsProvider: process.env.EXPO_PUBLIC_OPENCLAW_TTS_PROVIDER ?? 'expo',
  },
});
