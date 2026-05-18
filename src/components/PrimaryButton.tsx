import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../hooks/useAppTheme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
}

export const PrimaryButton = ({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: PrimaryButtonProps) => {
  const theme = useAppTheme();

  const buttonStyles =
    variant === 'primary'
      ? {
          backgroundColor: theme.colors.primary,
          borderColor: theme.colors.primary,
          textColor: '#ffffff',
        }
      : variant === 'secondary'
        ? {
            backgroundColor: theme.colors.primarySoft,
            borderColor: theme.colors.primarySoft,
            textColor: theme.colors.text,
          }
        : variant === 'danger'
          ? {
              backgroundColor: theme.colors.danger,
              borderColor: theme.colors.danger,
              textColor: '#ffffff',
            }
          : {
              backgroundColor: 'transparent',
              borderColor: theme.colors.border,
              textColor: theme.colors.text,
            };

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: buttonStyles.backgroundColor,
          borderColor: buttonStyles.borderColor,
          borderRadius: theme.radii.md,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
        },
      ]}
    >
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={buttonStyles.textColor} />
          <Text style={[styles.label, { color: buttonStyles.textColor }]}>
            {label}
          </Text>
        </View>
      ) : (
        <Text style={[styles.label, { color: buttonStyles.textColor }]}>{label}</Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 54,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
});
