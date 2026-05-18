import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { OrbVisualizer } from '../components/OrbVisualizer';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenContainer } from '../components/ScreenContainer';
import { StatusPill } from '../components/StatusPill';
import { appEnv } from '../config/env';
import { useAppTheme } from '../hooks/useAppTheme';
import type { RootStackParamList } from '../navigation/types';
import { createLiveVoiceSessionService } from '../services/liveVoiceSessionService';
import { createOpenAIRealtimeService } from '../services/openaiRealtimeService';
import { createOpenClawClient } from '../services/openClawClient';
import { secureStorageService } from '../services/secureStorageService';
import { textToSpeechService } from '../services/textToSpeechService';
import { voiceInputService } from '../services/voiceInputService';
import { useAppStore } from '../store/appStore';
import type { ConversationMessage } from '../types/app';
import type {
  OpenAIRealtimeState,
  OpenAIRealtimeTranscript,
} from '../types/openaiRealtime';
import type {
  LiveVoiceConnectionState,
  LiveVoiceTranscriptEvent,
  OpenClawLiveVoiceSession,
} from '../types/realtime';
import { createId } from '../utils/gateway';

type Props = NativeStackScreenProps<RootStackParamList, 'VoiceChat'>;

export const VoiceChatScreen = ({ navigation }: Props) => {
  const theme = useAppTheme();
  const gatewayUrl = useAppStore((state) => state.gatewayUrl);
  const gatewayLabel = useAppStore((state) => state.gatewayLabel);
  const authToken = useAppStore((state) => state.authToken);
  const isMockMode = useAppStore((state) => state.isMockMode);
  const connectionStatus = useAppStore((state) => state.connectionStatus);
  const selectedAgentId = useAppStore((state) => state.selectedAgentId);
  const selectedSessionId = useAppStore((state) => state.selectedSessionId);
  const agents = useAppStore((state) => state.agents);
  const sessions = useAppStore((state) => state.sessions);
  const conversationHistory = useAppStore((state) => state.conversationHistory);
  const voiceState = useAppStore((state) => state.voiceState);
  const liveTranscript = useAppStore((state) => state.liveTranscript);
  const partialTranscript = useAppStore((state) => state.partialTranscript);
  const voiceProvider = useAppStore((state) => state.voiceProvider);
  const ttsEnabled = useAppStore((state) => state.ttsEnabled);
  const continuousMode = useAppStore((state) => state.continuousMode);
  const captionsEnabled = useAppStore((state) => state.captionsEnabled);
  const isSpeaking = useAppStore((state) => state.isSpeaking);
  const volumeLevel = useAppStore((state) => state.volumeLevel);
  const setConversationHistory = useAppStore((state) => state.setConversationHistory);
  const appendMessage = useAppStore((state) => state.appendMessage);
  const upsertSession = useAppStore((state) => state.upsertSession);
  const setConnectionStatus = useAppStore((state) => state.setConnectionStatus);
  const setVoicePresentation = useAppStore((state) => state.setVoicePresentation);
  const setCaptionsEnabled = useAppStore((state) => state.setCaptionsEnabled);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [micMuted, setMicMuted] = useState(!continuousMode);
  const [liveConnectionState, setLiveConnectionState] =
    useState<LiveVoiceConnectionState>('disconnected');
  const interruptedSpeakingRef = useRef(false);
  const micMutedRef = useRef(!continuousMode);
  const liveVoiceServiceRef = useRef<ReturnType<
    typeof createLiveVoiceSessionService
  > | null>(null);
  const liveVoiceSessionRef = useRef<OpenClawLiveVoiceSession | null>(null);
  const openaiRealtimeServiceRef = useRef<ReturnType<
    typeof createOpenAIRealtimeService
  > | null>(null);
  const liveVoiceEnabled = !isMockMode && appEnv.voiceTransport === 'livekit';
  const openaiRealtimeEnabled =
    !isMockMode && appEnv.voiceTransport === 'openai-realtime';

  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? null;
  const selectedSession = sessions.find((session) => session.id === selectedSessionId) ?? null;
  const messages = selectedSessionId
    ? conversationHistory[selectedSessionId] ?? []
    : [];

  const createClient = useCallback(
    () =>
      createOpenClawClient({
        gatewayUrl,
        authToken,
        isMockMode,
      }),
    [authToken, gatewayUrl, isMockMode],
  );

  const persistPreferences = useCallback(async () => {
    await secureStorageService.updateAppState({
      gatewayUrl,
      gatewayLabel,
      authToken,
      selectedAgentId,
      selectedSessionId,
      isMockMode,
      continuousMode: useAppStore.getState().continuousMode,
      ttsEnabled: useAppStore.getState().ttsEnabled,
      captionsEnabled: useAppStore.getState().captionsEnabled,
    });
  }, [
    authToken,
    gatewayLabel,
    gatewayUrl,
    isMockMode,
    selectedAgentId,
    selectedSessionId,
  ]);

  const updateSessionPreview = useCallback(
    (preview: string, bumpCount: number) => {
      if (!selectedSessionId) {
        return;
      }

      const currentSession = useAppStore
        .getState()
        .sessions.find((session) => session.id === selectedSessionId);

      if (!currentSession) {
        return;
      }

      upsertSession({
        ...currentSession,
        preview,
        updatedAt: new Date().toISOString(),
        messageCount: currentSession.messageCount + bumpCount,
      });
    },
    [selectedSessionId, upsertSession],
  );

  const upsertConversationMessage = useCallback(
    (message: ConversationMessage) => {
      const current = useAppStore.getState().conversationHistory[message.sessionId] ?? [];
      const existingIndex = current.findIndex((entry) => entry.id === message.id);

      if (existingIndex === -1) {
        setConversationHistory(message.sessionId, [...current, message]);
        return true;
      }

      setConversationHistory(
        message.sessionId,
        current.map((entry, index) =>
          index === existingIndex ? { ...entry, ...message } : entry,
        ),
      );
      return false;
    },
    [setConversationHistory],
  );

  const disconnectLiveSession = useCallback(async () => {
    const liveService = liveVoiceServiceRef.current;
    const liveSession = liveVoiceSessionRef.current;

    liveVoiceServiceRef.current = null;
    liveVoiceSessionRef.current = null;
    setLiveConnectionState('disconnected');

    if (liveService) {
      await liveService.disconnect();
    }

    if (liveSession && selectedAgentId && selectedSessionId) {
      try {
        await createClient().endLiveVoiceSession(
          selectedAgentId,
          selectedSessionId,
          liveSession.id,
        );
      } catch {
        // Best-effort teardown.
      }
    }

    setVoicePresentation({
      isSpeaking: false,
      liveTranscript: '',
      partialTranscript: '',
      volumeLevel: 0,
      voiceState: 'idle',
    });
  }, [
    createClient,
    selectedAgentId,
    selectedSessionId,
    setVoicePresentation,
  ]);

  const disconnectOpenAIRealtime = useCallback(async () => {
    const realtimeService = openaiRealtimeServiceRef.current;
    openaiRealtimeServiceRef.current = null;
    setLiveConnectionState('disconnected');

    if (realtimeService) {
      await realtimeService.disconnect();
    }

    setVoicePresentation({
      isSpeaking: false,
      liveTranscript: '',
      partialTranscript: '',
      volumeLevel: 0,
      voiceState: 'idle',
    });
  }, [setVoicePresentation]);

  const handleOpenAIRealtimeTranscript = useCallback(
    (transcript: OpenAIRealtimeTranscript) => {
      if (!selectedSessionId) {
        return;
      }

      const text = transcript.text.trim();
      if (!text) {
        return;
      }

      setErrorMessage(null);

      if (!transcript.final) {
        setVoicePresentation({
          liveTranscript: text,
          partialTranscript: text,
          voiceState: transcript.role === 'assistant' ? 'speaking' : 'listening',
        });
        return;
      }

      const role = transcript.role === 'assistant' ? 'agent' : 'user';
      const message: ConversationMessage = {
        id: `realtime-${role}-${transcript.id}`,
        sessionId: selectedSessionId,
        role,
        text,
        createdAt: new Date(transcript.timestamp).toISOString(),
        status: 'sent',
      };

      const isNew = upsertConversationMessage(message);

      if (isNew) {
        updateSessionPreview(text, 1);
      }

      setVoicePresentation({
        liveTranscript: text,
        partialTranscript: '',
        voiceState:
          transcript.role === 'user'
            ? 'processing'
            : useAppStore.getState().continuousMode && !micMutedRef.current
              ? 'listening'
              : 'idle',
      });
    },
    [
      selectedSessionId,
      setVoicePresentation,
      updateSessionPreview,
      upsertConversationMessage,
    ],
  );

  const mapOpenAIRealtimeState = (
    state: OpenAIRealtimeState,
  ): LiveVoiceConnectionState => {
    switch (state) {
      case 'connecting':
        return 'connecting';
      case 'connected':
      case 'listening':
      case 'processing':
      case 'speaking':
        return 'connected';
      case 'disconnected':
      case 'idle':
        return 'disconnected';
      case 'error':
        return 'disconnected';
      default:
        return 'disconnected';
    }
  };

  const connectOpenAIRealtime = useCallback(async () => {
    if (!selectedAgentId || !selectedSessionId) {
      return;
    }

    const realtimeService = createOpenAIRealtimeService();
    openaiRealtimeServiceRef.current = realtimeService;
    setLiveConnectionState('connecting');
    setConnectionStatus('connecting');
    setErrorMessage(null);
    setVoicePresentation({
      voiceProvider: 'openai-realtime',
      liveTranscript: '',
      partialTranscript: '',
      voiceState: 'processing',
      isSpeaking: false,
      volumeLevel: 0,
    });

    try {
      await realtimeService.connect(
        {
          apiKey: appEnv.openaiApiKey,
          model: appEnv.openaiRealtimeModel,
          voice: appEnv.openaiRealtimeVoice,
          reasoningEffort: appEnv.openaiRealtimeReasoningEffort,
          gatewayUrl: isMockMode ? undefined : gatewayUrl,
          agentId: selectedAgentId,
          sessionId: selectedSessionId,
          instructions: `You are a helpful voice assistant for OpenClaw. You are speaking with a user through the Spiq mobile app.
Keep responses concise and conversational (2-3 sentences unless more detail is requested).
Be friendly, helpful, and efficient.`,
        },
        {
          onStateChange: (state) => {
            setLiveConnectionState(mapOpenAIRealtimeState(state));

            if (state === 'connected' || state === 'listening') {
              setConnectionStatus('connected');
            } else if (state === 'connecting') {
              setConnectionStatus('connecting');
            } else if (state === 'disconnected' || state === 'error') {
              setConnectionStatus('offline', 'OpenAI Realtime 2.0 disconnected.');
            }

            // Map to voice state
            if (state === 'listening') {
              setVoicePresentation({ voiceState: 'listening' });
            } else if (state === 'processing') {
              setVoicePresentation({ voiceState: 'processing' });
            } else if (state === 'speaking') {
              setVoicePresentation({ voiceState: 'speaking', isSpeaking: true });
            } else if (state === 'connected') {
              setVoicePresentation({ voiceState: 'listening' });
            }
          },
          onTranscript: handleOpenAIRealtimeTranscript,
          onError: (message) => {
            setErrorMessage(message);
            setVoicePresentation({
              isSpeaking: false,
              volumeLevel: 0,
              voiceState: 'error',
            });
          },
          onConnected: () => {
            setConnectionStatus('connected');
            setVoicePresentation({
              voiceState: 'listening',
              isSpeaking: false,
            });
          },
          onDisconnected: () => {
            setLiveConnectionState('disconnected');
            setVoicePresentation({
              isSpeaking: false,
              volumeLevel: 0,
              voiceState: 'idle',
            });
          },
        },
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to connect to OpenAI Realtime.';

      setErrorMessage(message);
      setLiveConnectionState('disconnected');
      setConnectionStatus('offline', message);
      setVoicePresentation({
        isSpeaking: false,
        volumeLevel: 0,
        voiceState: 'error',
      });
      await disconnectOpenAIRealtime();
    }
  }, [
    disconnectOpenAIRealtime,
    gatewayUrl,
    handleOpenAIRealtimeTranscript,
    isMockMode,
    selectedAgentId,
    selectedSessionId,
    setConnectionStatus,
    setVoicePresentation,
  ]);

  const handleLiveTranscript = useCallback(
    (event: LiveVoiceTranscriptEvent) => {
      if (!selectedSessionId) {
        return;
      }

      const text = event.text.trim();

      if (!text) {
        return;
      }

      setErrorMessage(null);

      if (!event.final) {
        setVoicePresentation({
          liveTranscript: text,
          partialTranscript: text,
          voiceState: event.role === 'agent' ? 'speaking' : 'listening',
        });
        return;
      }

      const message: ConversationMessage = {
        id: `live-${event.role}-${event.id}`,
        sessionId: selectedSessionId,
        role: event.role,
        text,
        createdAt: event.receivedAt,
        status: 'sent',
      };

      const isNew = upsertConversationMessage(message);

      if (isNew) {
        updateSessionPreview(text, 1);
      }

      setVoicePresentation({
        liveTranscript: text,
        partialTranscript: '',
        voiceState:
          event.role === 'user'
            ? 'processing'
            : useAppStore.getState().continuousMode && !micMutedRef.current
              ? 'listening'
              : 'idle',
      });
    },
    [
      selectedSessionId,
      setVoicePresentation,
      updateSessionPreview,
      upsertConversationMessage,
    ],
  );

  const connectLiveSession = useCallback(async () => {
    if (!selectedAgentId || !selectedSessionId) {
      return;
    }

    const liveService = createLiveVoiceSessionService();
    liveVoiceServiceRef.current = liveService;
    setLiveConnectionState('connecting');
    setConnectionStatus('connecting');
    setErrorMessage(null);
    setVoicePresentation({
      voiceProvider: 'livekit-room',
      liveTranscript: '',
      partialTranscript: '',
      voiceState: 'processing',
      isSpeaking: false,
      volumeLevel: 0,
    });

    try {
      const liveSession = await createClient().createLiveVoiceSession(
        selectedAgentId,
        selectedSessionId,
      );

      liveVoiceSessionRef.current = liveSession;

      await liveService.connect(
        liveSession,
        {
          onConnectionStateChange: (state) => {
            setLiveConnectionState(state);

            if (state === 'connected') {
              setConnectionStatus('connected');
              return;
            }

            if (state === 'connecting' || state === 'reconnecting') {
              setConnectionStatus('connecting');
              return;
            }

            setConnectionStatus(
              'offline',
              'The live voice session disconnected from the OpenClaw Gateway.',
            );
          },
          onVoiceStateChange: (state) => {
            setVoicePresentation({
              voiceProvider: 'livekit-room',
              voiceState: state,
            });
          },
          onTranscript: (event) => {
            handleLiveTranscript(event);
          },
          onSpeakingStatusChange: (speaking) => {
            setVoicePresentation({
              isSpeaking: speaking,
            });
          },
          onVolumeChange: (value) => {
            setVoicePresentation({
              volumeLevel: Math.max(0, value),
            });
          },
          onError: (message) => {
            setErrorMessage(message);
            setVoicePresentation({
              isSpeaking: false,
              volumeLevel: 0,
              voiceState: 'error',
            });
          },
        },
        {
          startMuted:
            !useAppStore.getState().continuousMode || micMutedRef.current,
        },
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to start the live voice session.';

      setErrorMessage(message);
      setLiveConnectionState('disconnected');
      setConnectionStatus('offline', message);
      setVoicePresentation({
        isSpeaking: false,
        volumeLevel: 0,
        voiceState: 'error',
      });
      await disconnectLiveSession();
    }
  }, [
    createClient,
    disconnectLiveSession,
    handleLiveTranscript,
    selectedAgentId,
    selectedSessionId,
    setConnectionStatus,
    setVoicePresentation,
  ]);

  const startListening = useCallback(async () => {
    if (liveVoiceEnabled || openaiRealtimeEnabled) {
      return;
    }

    interruptedSpeakingRef.current = false;

    if (await textToSpeechService.isSpeaking()) {
      interruptedSpeakingRef.current = true;
      await textToSpeechService.stop();
      setVoicePresentation({
        isSpeaking: false,
        voiceState: 'idle',
      });
    }

    const granted = await voiceInputService.requestPermissions();

    if (!granted) {
      setErrorMessage('Microphone or speech recognition permission was denied.');
      setVoicePresentation({
        voiceState: 'error',
      });
      Alert.alert(
        'Voice permission required',
        'Allow microphone and speech recognition access to talk with your OpenClaw agent.',
      );
      return;
    }

    setErrorMessage(null);
    setVoicePresentation({
      voiceProvider: voiceInputService.providerName,
      liveTranscript: '',
      partialTranscript: '',
      voiceState: 'listening',
      volumeLevel: 0,
    });

    try {
      await voiceInputService.startListening({
        continuous: false,
        language: 'en-US',
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to start listening on this device.',
      );
      setVoicePresentation({
        voiceState: 'error',
      });
    }
  }, [liveVoiceEnabled, openaiRealtimeEnabled, setVoicePresentation]);

  const stopSpeaking = useCallback(async () => {
    interruptedSpeakingRef.current = true;

    if (openaiRealtimeEnabled) {
      openaiRealtimeServiceRef.current?.interrupt();
      setVoicePresentation({
        isSpeaking: false,
        voiceState: 'listening',
      });
      return;
    }

    if (liveVoiceEnabled) {
      await liveVoiceServiceRef.current?.interrupt();
      setVoicePresentation({
        isSpeaking: false,
        voiceState: micMutedRef.current ? 'idle' : 'listening',
      });
      return;
    }

    await textToSpeechService.stop();
    setVoicePresentation({
      isSpeaking: false,
      voiceState: 'idle',
    });
  }, [liveVoiceEnabled, openaiRealtimeEnabled, setVoicePresentation]);

  const handleFinalTranscript = useCallback(
    async (transcript: string) => {
      if (!selectedSessionId || liveVoiceEnabled || openaiRealtimeEnabled) {
        return;
      }

      const text = transcript.trim();

      if (!text) {
        setVoicePresentation({
          voiceState: 'idle',
          partialTranscript: '',
        });
        return;
      }

      const userMessage: ConversationMessage = {
        id: createId('msg'),
        sessionId: selectedSessionId,
        role: 'user',
        text,
        createdAt: new Date().toISOString(),
        status: 'sent',
      };

      appendMessage(userMessage);
      updateSessionPreview(text, 1);
      setVoicePresentation({
        liveTranscript: text,
        partialTranscript: '',
        voiceState: 'processing',
        volumeLevel: 0,
      });

      try {
        const reply = await createClient().sendMessage(selectedSessionId, text);
        appendMessage(reply);
        updateSessionPreview(reply.text, 1);
        setConnectionStatus('connected');

        if (!useAppStore.getState().ttsEnabled) {
          setVoicePresentation({
            isSpeaking: false,
            voiceState: 'idle',
          });

          if (useAppStore.getState().continuousMode && !micMutedRef.current) {
            void startListening();
          }

          return;
        }

        interruptedSpeakingRef.current = false;

        try {
          await textToSpeechService.speak(reply.text, {
            onStart: () => {
              setVoicePresentation({
                isSpeaking: true,
                voiceState: 'speaking',
              });
            },
            onDone: () => {
              setVoicePresentation({
                isSpeaking: false,
                voiceState: 'idle',
              });
            },
            onStopped: () => {
              setVoicePresentation({
                isSpeaking: false,
                voiceState: 'idle',
              });
            },
            onError: (message) => {
              setErrorMessage(message);
            },
          });
        } finally {
          setVoicePresentation({
            isSpeaking: false,
            voiceState: 'idle',
          });
        }

        if (
          useAppStore.getState().continuousMode &&
          !interruptedSpeakingRef.current &&
          !micMutedRef.current
        ) {
          void startListening();
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to send that message to the Gateway.';

        setErrorMessage(message);
        setConnectionStatus(
          'offline',
          'OpenClaw Gateway is offline or unreachable. Automatic reconnect will retry.',
        );
        appendMessage({
          id: createId('msg'),
          sessionId: selectedSessionId,
          role: 'system',
          text: 'The Gateway could not be reached. Check connection settings or wait for reconnect.',
          createdAt: new Date().toISOString(),
        });
        setVoicePresentation({
          isSpeaking: false,
          voiceState: 'error',
        });
      }
    },
    [
      appendMessage,
      createClient,
      liveVoiceEnabled,
      selectedSessionId,
      setConnectionStatus,
      setVoicePresentation,
      startListening,
      updateSessionPreview,
    ],
  );

  useEffect(() => {
    micMutedRef.current = micMuted;
  }, [micMuted]);

  useEffect(() => {
    if (!selectedSessionId || !selectedAgentId) {
      navigation.replace('AgentSelector');
      return;
    }

    if ((conversationHistory[selectedSessionId] ?? []).length > 0) {
      return;
    }

    let active = true;

    const loadHistory = async () => {
      try {
        const history = await createClient().getConversationHistory(selectedSessionId);

        if (active) {
          setConversationHistory(selectedSessionId, history);
        }
      } catch {
        if (active) {
          setErrorMessage('Unable to load this session history from the Gateway.');
        }
      }
    };

    void loadHistory();

    return () => {
      active = false;
    };
  }, [
    conversationHistory,
    createClient,
    navigation,
    selectedAgentId,
    selectedSessionId,
    setConversationHistory,
  ]);

  useEffect(() => {
    if (!liveVoiceEnabled) {
      return;
    }

    void connectLiveSession();

    return () => {
      void disconnectLiveSession();
    };
  }, [connectLiveSession, disconnectLiveSession, liveVoiceEnabled]);

  useEffect(() => {
    if (!openaiRealtimeEnabled) {
      return;
    }

    void connectOpenAIRealtime();

    return () => {
      void disconnectOpenAIRealtime();
    };
  }, [connectOpenAIRealtime, disconnectOpenAIRealtime, openaiRealtimeEnabled]);

  useEffect(() => {
    if (liveVoiceEnabled || openaiRealtimeEnabled) {
      return;
    }

    const unsubscribe = voiceInputService.subscribe({
      onStateChange: (nextState) => {
        const currentState = useAppStore.getState().voiceState;

        if (nextState === 'idle' && currentState === 'processing') {
          return;
        }

        setVoicePresentation({
          voiceState: nextState,
          volumeLevel:
            nextState === 'listening' ? useAppStore.getState().volumeLevel : 0,
        });
      },
      onPartialTranscript: (text) => {
        setVoicePresentation({
          partialTranscript: text,
          liveTranscript: text,
          voiceState: 'listening',
        });
      },
      onFinalTranscript: (text) => {
        setVoicePresentation({
          partialTranscript: '',
          liveTranscript: text,
          voiceState: 'processing',
          volumeLevel: 0,
        });
        void handleFinalTranscript(text);
      },
      onError: (message) => {
        setErrorMessage(message);
        setVoicePresentation({
          voiceState: 'error',
          volumeLevel: 0,
        });
      },
      onVolumeChange: (value) => {
        setVoicePresentation({
          volumeLevel: Math.max(0, value),
        });
      },
    });

    setVoicePresentation({
      voiceProvider: voiceInputService.providerName,
    });

    return () => {
      unsubscribe();
      void voiceInputService.abortListening();
      void textToSpeechService.stop();
    };
  }, [handleFinalTranscript, liveVoiceEnabled, setVoicePresentation]);

  useEffect(() => {
    if (liveVoiceEnabled) {
      const nextMuted = !continuousMode;
      setMicMuted(nextMuted);
      micMutedRef.current = nextMuted;

      if (liveVoiceServiceRef.current) {
        void liveVoiceServiceRef.current.setMicrophoneEnabled(!nextMuted);
      }

      setVoicePresentation({
        voiceState:
          useAppStore.getState().connectionStatus === 'connected' && !nextMuted
            ? 'listening'
            : 'idle',
        volumeLevel: nextMuted ? 0 : useAppStore.getState().volumeLevel,
      });
      return;
    }

    if (!continuousMode) {
      setMicMuted(true);
      micMutedRef.current = true;
      void voiceInputService.abortListening();
      setVoicePresentation({
        voiceState: 'idle',
        volumeLevel: 0,
      });
      return;
    }

    setMicMuted(false);
    micMutedRef.current = false;
  }, [
    continuousMode,
    liveVoiceEnabled,
    setVoicePresentation,
  ]);

  useEffect(() => {
    if (
      liveVoiceEnabled ||
      !continuousMode ||
      micMuted ||
      isSpeaking ||
      voiceState !== 'idle' ||
      connectionStatus !== 'connected'
    ) {
      return;
    }

    void startListening();
  }, [
    connectionStatus,
    continuousMode,
    isSpeaking,
    liveVoiceEnabled,
    micMuted,
    startListening,
    voiceState,
  ]);

  const latestAgentReply = useMemo(
    () => [...messages].reverse().find((message) => message.role === 'agent')?.text ?? '',
    [messages],
  );

  const statusTitle = openaiRealtimeEnabled
    ? liveConnectionState === 'connecting'
      ? 'Connecting…'
      : voiceState === 'processing'
        ? 'Thinking…'
        : voiceState === 'speaking'
          ? 'Speaking…'
          : voiceState === 'listening'
            ? 'Listening…'
            : 'Realtime'
    : liveVoiceEnabled
      ? liveConnectionState === 'connecting'
        ? 'Connecting…'
        : liveConnectionState === 'reconnecting'
          ? 'Reconnecting…'
          : continuousMode
            ? micMuted
              ? 'Microphone muted'
              : voiceState === 'processing'
                ? 'Thinking…'
                : voiceState === 'speaking'
                  ? 'Speaking…'
                  : voiceState === 'listening'
                    ? 'Listening…'
                    : 'Live'
            : voiceState === 'processing'
              ? 'Thinking…'
              : voiceState === 'speaking'
                ? 'Speaking…'
                : voiceState === 'listening'
                  ? 'Listening…'
                  : 'Push to talk'
      : continuousMode
        ? micMuted
          ? 'Microphone muted'
          : voiceState === 'processing'
            ? 'Thinking…'
            : voiceState === 'speaking'
              ? 'Speaking…'
              : voiceState === 'listening'
                ? 'Listening…'
                : 'Ready'
        : voiceState === 'processing'
          ? 'Thinking…'
          : voiceState === 'speaking'
            ? 'Speaking…'
            : voiceState === 'listening'
              ? 'Listening…'
              : 'Push to talk';

  const statusCopy = openaiRealtimeEnabled
    ? liveConnectionState === 'connecting'
      ? 'Connecting to OpenAI Realtime 2.0 for ultra-low latency voice.'
      : 'OpenAI Realtime 2.0 is active. Just speak naturally to interact.'
    : liveVoiceEnabled
      ? liveConnectionState === 'connecting'
        ? 'Joining the low-latency voice room from your OpenClaw Gateway.'
        : liveConnectionState === 'reconnecting'
          ? 'Realtime audio is recovering after a network interruption.'
          : continuousMode
            ? micMuted
              ? 'Tap unmute to return to the live hands-free flow.'
              : 'Live voice is active. Start talking to barge in on the agent.'
            : 'Push-to-talk live mode is active. Tap Talk, speak, then tap Send.'
      : continuousMode
        ? micMuted
          ? 'Tap unmute to return to the ChatGPT-style hands-free flow.'
          : 'Hands-free voice mode is active. The app will reopen the mic after replies.'
        : 'Push-to-talk fallback is active. Tap the center control to speak.';

  const captionText = partialTranscript || liveTranscript || latestAgentReply;
  const shouldShowCaptions = captionsEnabled || Boolean(partialTranscript);

  const toggleCaptions = async () => {
    setCaptionsEnabled(!captionsEnabled);
    await persistPreferences();
  };

  const handlePrimaryControl = async () => {
    // OpenAI Realtime - always-on listening, just interrupt when speaking
    if (openaiRealtimeEnabled) {
      const realtimeService = openaiRealtimeServiceRef.current;

      if (!realtimeService) {
        await connectOpenAIRealtime();
        return;
      }

      if (voiceState === 'speaking' || isSpeaking) {
        await stopSpeaking();
        return;
      }

      // For OpenAI Realtime, the mic is always on via WebRTC
      // The button acts as a visual feedback / interrupt control
      return;
    }

    if (liveVoiceEnabled) {
      const liveService = liveVoiceServiceRef.current;

      if (!liveService) {
        await connectLiveSession();
        return;
      }

      if (voiceState === 'speaking' || isSpeaking) {
        await stopSpeaking();
        return;
      }

      const nextMuted = !micMutedRef.current;
      setMicMuted(nextMuted);
      micMutedRef.current = nextMuted;
      await liveService.setMicrophoneEnabled(!nextMuted);
      setVoicePresentation({
        voiceState: nextMuted ? (continuousMode ? 'idle' : 'processing') : 'listening',
        volumeLevel: nextMuted ? 0 : useAppStore.getState().volumeLevel,
      });
      return;
    }

    if (voiceState === 'speaking' || isSpeaking) {
      await stopSpeaking();
      if (continuousMode && !micMutedRef.current) {
        await startListening();
      }
      return;
    }

    if (continuousMode) {
      if (micMuted) {
        setMicMuted(false);
        micMutedRef.current = false;
        return;
      }

      setMicMuted(true);
      micMutedRef.current = true;
      await voiceInputService.abortListening();
      setVoicePresentation({
        voiceState: 'idle',
        volumeLevel: 0,
      });
      return;
    }

    if (voiceState === 'listening') {
      await voiceInputService.stopListening();
      return;
    }

    await startListening();
  };

  const endConversation = async () => {
    if (openaiRealtimeEnabled) {
      await disconnectOpenAIRealtime();
    } else if (liveVoiceEnabled) {
      await disconnectLiveSession();
    } else {
      await voiceInputService.abortListening();
      await textToSpeechService.stop();
    }

    navigation.navigate('AgentSelector');
  };

  if (!selectedAgent || !selectedSessionId) {
    return (
      <ScreenContainer contentContainerStyle={styles.centered}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          No agent session selected
        </Text>
        <PrimaryButton
          label="Choose agent"
          onPress={() => navigation.replace('AgentSelector')}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerMeta}>
            <Text style={[styles.agentLabel, { color: theme.colors.accent }]}>
              {selectedAgent.name}
            </Text>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Voice conversation
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
              {gatewayLabel ?? gatewayUrl} • {voiceProvider}
            </Text>
          </View>
          <StatusPill status={connectionStatus} />
        </View>

        <View style={styles.topButtons}>
          <Pressable
            onPress={() => navigation.navigate('ConversationHistory')}
            style={[
              styles.topButton,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.pill,
              },
            ]}
          >
            <Text style={[styles.topButtonText, { color: theme.colors.text }]}>
              History
            </Text>
          </Pressable>
          <Pressable
            onPress={() => void toggleCaptions()}
            style={[
              styles.topButton,
              {
                backgroundColor: captionsEnabled
                  ? theme.colors.primarySoft
                  : theme.colors.surface,
                borderColor: captionsEnabled
                  ? theme.colors.primary
                  : theme.colors.border,
                borderRadius: theme.radii.pill,
              },
            ]}
          >
            <Text
              style={[
                styles.topButtonText,
                { color: captionsEnabled ? theme.colors.primary : theme.colors.text },
              ]}
            >
              CC
            </Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('Settings')}
            style={[
              styles.topButton,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.pill,
              },
            ]}
          >
            <Text style={[styles.topButtonText, { color: theme.colors.text }]}>
              Settings
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.centerArea}>
        <OrbVisualizer state={voiceState} volumeLevel={volumeLevel} />

        <View style={styles.statusBlock}>
          <Text style={[styles.statusTitle, { color: theme.colors.text }]}>
            {statusTitle}
          </Text>
          <Text style={[styles.statusCopy, { color: theme.colors.textMuted }]}>
            {statusCopy}
          </Text>
        </View>

        {shouldShowCaptions ? (
          <View
            style={[
              styles.captionCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.lg,
              },
            ]}
          >
            <Text style={[styles.captionLabel, { color: theme.colors.textMuted }]}>
              {partialTranscript
                ? 'Live caption'
                : voiceState === 'speaking'
                  ? `${selectedAgent.name} said`
                  : 'Latest transcript'}
            </Text>
            <Text style={[styles.captionText, { color: theme.colors.text }]}>
              {captionText || 'Captions will appear here during the conversation.'}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.bottomArea}>
        <View style={styles.controlRow}>
          <Pressable
            onPress={() => navigation.navigate('ConversationHistory')}
            style={[
              styles.secondaryControl,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.round,
              },
            ]}
          >
            <Text style={[styles.secondaryControlText, { color: theme.colors.text }]}>
              Log
            </Text>
          </Pressable>

          <Pressable
            onPress={() => void handlePrimaryControl()}
            style={[
              styles.primaryControl,
              {
                backgroundColor:
                  voiceState === 'speaking'
                    ? theme.colors.warning
                    : continuousMode
                      ? micMuted
                        ? theme.colors.surface
                        : theme.colors.primary
                      : voiceState === 'listening'
                        ? theme.colors.accent
                        : theme.colors.primary,
                borderColor:
                  micMuted && continuousMode
                    ? theme.colors.border
                    : theme.colors.primary,
                borderRadius: theme.radii.round,
              },
            ]}
          >
            <Text
              style={[
                styles.primaryControlLabel,
                {
                  color:
                    micMuted && continuousMode
                      ? theme.colors.text
                      : '#ffffff',
                },
              ]}
            >
              {voiceState === 'speaking'
                ? 'Interrupt'
                : continuousMode
                  ? micMuted
                    ? 'Unmute'
                    : 'Mute'
                  : voiceState === 'listening'
                    ? 'Send'
                    : 'Talk'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => void endConversation()}
            style={[
              styles.secondaryControl,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.round,
              },
            ]}
          >
            <Text style={[styles.secondaryControlText, { color: theme.colors.text }]}>
              End
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.footerNote, { color: theme.colors.textMuted }]}>
          Full transcript stays in session history after you leave voice mode.
        </Text>

        {errorMessage ? (
          <Text style={[styles.errorText, { color: theme.colors.danger }]}>
            {errorMessage}
          </Text>
        ) : null}
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'space-between',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    gap: 14,
  },
  headerTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
  },
  headerMeta: {
    gap: 6,
  },
  topButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  topButton: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  topButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  agentLabel: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
  },
  centerArea: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  statusBlock: {
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  statusTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  statusCopy: {
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 320,
    textAlign: 'center',
  },
  captionCard: {
    borderWidth: 1,
    gap: 8,
    marginTop: 28,
    minHeight: 94,
    padding: 18,
    width: '100%',
  },
  captionLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  captionText: {
    fontSize: 17,
    lineHeight: 25,
  },
  bottomArea: {
    gap: 14,
  },
  controlRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  secondaryControl: {
    alignItems: 'center',
    borderWidth: 1,
    height: 76,
    justifyContent: 'center',
    width: 76,
  },
  secondaryControlText: {
    fontSize: 14,
    fontWeight: '700',
  },
  primaryControl: {
    alignItems: 'center',
    borderWidth: 1,
    height: 118,
    justifyContent: 'center',
    width: 118,
  },
  primaryControlLabel: {
    fontSize: 18,
    fontWeight: '800',
  },
  footerNote: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
