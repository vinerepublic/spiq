import 'react-native-gesture-handler';

import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAppBootstrap } from './src/hooks/useAppBootstrap';
import { useAppTheme } from './src/hooks/useAppTheme';
import { useConnectionRecovery } from './src/hooks/useConnectionRecovery';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAppStore } from './src/store/appStore';

const AppContent = () => {
  const theme = useAppTheme();
  const hydrated = useAppStore((state) => state.hydrated);

  useAppBootstrap();
  useConnectionRecovery();

  if (!hydrated) {
    return (
      <View
        style={[
          styles.loadingScreen,
          {
            backgroundColor: theme.colors.background,
          },
        ]}
      >
        <ActivityIndicator color={theme.colors.primary} size="large" />
        <Text style={[styles.loadingText, { color: theme.colors.text }]}>
          Syncing Spiq with OpenClaw…
        </Text>
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={{
        ...(theme.dark ? DarkTheme : DefaultTheme),
        colors: {
          ...(theme.dark ? DarkTheme.colors : DefaultTheme.colors),
          background: theme.colors.background,
          card: theme.colors.surface,
          border: theme.colors.border,
          primary: theme.colors.primary,
          text: theme.colors.text,
          notification: theme.colors.accent,
        },
      }}
    >
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <RootNavigator />
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AppContent />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingScreen: {
    alignItems: 'center',
    flex: 1,
    gap: 16,
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
