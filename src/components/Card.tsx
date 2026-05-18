import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '../hooks/useAppTheme';

interface CardProps extends PropsWithChildren {
  style?: StyleProp<ViewStyle>;
}

export const Card = ({ children, style }: CardProps) => {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.lg,
          padding: theme.spacing.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
});
