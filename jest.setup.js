// Jest setup file for additional configuration

// Mock @react-native-async-storage/async-storage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock expo-audio
jest.mock('expo-audio', () => ({
  Audio: {
    setAudioModeAsync: jest.fn(),
    Sound: {
      createAsync: jest.fn(),
    },
  },
}));

// Mock expo-speech
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  isSpeakingAsync: jest.fn(() => Promise.resolve(false)),
}));

// Mock expo-speech-recognition
jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
    requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    getSupportedLocales: jest.fn(() => Promise.resolve(['en-US'])),
    getDefaultRecognitionOptions: jest.fn(() => Promise.resolve({})),
    getAssistantStatus: jest.fn(() => Promise.resolve(false)),
    getSpeechRecognitionServices: jest.fn(() => Promise.resolve([])),
    getStateAsync: jest.fn(() => Promise.resolve('inactive')),
    supportsOnDeviceRecognition: jest.fn(() => Promise.resolve(false)),
    supportsRecording: jest.fn(() => Promise.resolve(false)),
    androidTriggerOfflineModelDownload: jest.fn(),
  },
}));

// Mock @livekit/react-native
jest.mock('@livekit/react-native', () => ({
  Room: jest.fn(),
  RoomEvent: {},
  ParticipantEvent: {},
  TrackEvent: {},
  DataPacket_Kind: {},
  connect: jest.fn(),
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
}));

// Silence console errors in tests (optional)
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};

// Set __DEV__ global
global.__DEV__ = true;
