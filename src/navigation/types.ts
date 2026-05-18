export type RootStackParamList = {
  Onboarding: undefined;
  GatewayConnect: undefined;
  Pairing:
    | {
        gatewayUrl?: string;
        pairingCode?: string;
        isMockMode?: boolean;
      }
    | undefined;
  AgentSelector: undefined;
  AgentMultiSelect: undefined;
  VoiceChat: undefined;
  Conference: undefined;
  ConversationHistory: undefined;
  Settings: undefined;
};
