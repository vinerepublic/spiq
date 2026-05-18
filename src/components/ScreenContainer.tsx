import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '../hooks/useAppTheme';

interface ScreenContainerProps extends PropsWithChildren {
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

export const ScreenContainer = ({
  children,
  scroll = false,
  style,
  contentContainerStyle,
}: ScreenContainerProps) => {
  const theme = useAppTheme();

  return (
    <SafeAreaView
      edges={['top', 'left', 'right', 'bottom']}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }, style]}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { padding: theme.spacing.lg },
            contentContainerStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View
          style={[
            styles.content,
            { padding: theme.spacing.lg },
            contentContainerStyle,
          ]}
        >
          {children}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
