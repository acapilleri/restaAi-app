import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { hapticLight } from '../../utils/haptics';

export type QuickChipsVariant = 'chat' | 'onboarding';

type Props = {
  chips: string[];
  onPress: (chip: string) => void;
  /** Stesso aspetto chip; solo padding del contenitore differisce tra schermata chat e onboarding. */
  variant?: QuickChipsVariant;
  disabled?: boolean;
};

export function QuickChips({ chips, onPress, variant = 'chat', disabled = false }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: { maxHeight: 52 },
        wrapChat: {
          paddingHorizontal: 10,
          paddingTop: 8,
          paddingBottom: 4,
          gap: 8,
          alignItems: 'center',
        },
        wrapOnboarding: {
          flexDirection: 'row',
          gap: 8,
          paddingBottom: 12,
          alignItems: 'center',
        },
        chip: {
          borderWidth: 1,
          borderColor: colors.greenPillBorder,
          backgroundColor: colors.bgCard,
          paddingVertical: 9,
          paddingHorizontal: 14,
          borderRadius: 999,
          marginRight: 8,
        },
        chipDisabled: {
          opacity: 0.45,
        },
        label: { fontSize: 13, fontWeight: '600', color: colors.primaryDark },
        labelDisabled: {
          color: colors.textMuted,
        },
      }),
    [colors],
  );

  if (!chips.length) return null;

  const wrapStyle = variant === 'onboarding' ? styles.wrapOnboarding : styles.wrapChat;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={wrapStyle}
    >
      {chips.map((chip) => (
        <TouchableOpacity
          key={chip}
          style={[styles.chip, disabled && styles.chipDisabled]}
          disabled={disabled}
          activeOpacity={0.85}
          onPress={() => {
            hapticLight();
            onPress(chip);
          }}
        >
          <Text style={[styles.label, disabled && styles.labelDisabled]}>{chip}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
