import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export type MultiChoiceOption = {
  id: string;
  label: string;
  disabled?: boolean;
};

type Props = {
  options: MultiChoiceOption[];
  selectedIds: string[];
  onChange: (nextSelectedIds: string[]) => void;
  multiple?: boolean;
  disabled?: boolean;
};

export function MultiChoice({
  options,
  selectedIds,
  onChange,
  multiple = true,
  disabled = false,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        },
        pill: {
          borderWidth: 1,
          borderRadius: 999,
          paddingHorizontal: 12,
          paddingVertical: 8,
        },
        pillActive: {
          backgroundColor: colors.greenPill,
          borderColor: colors.greenPillBorder,
        },
        pillInactive: {
          backgroundColor: colors.bgCard,
          borderColor: colors.borderStrong,
        },
        pillDisabled: {
          opacity: 0.45,
        },
        label: {
          fontSize: 13,
          fontWeight: '600',
        },
        labelActive: {
          color: colors.primaryDarkLabel,
        },
        labelInactive: {
          color: colors.textSecondary,
        },
        labelDisabled: {
          color: colors.textHint,
        },
      }),
    [colors],
  );

  const selectedSet = new Set(selectedIds);

  const onPressOption = (id: string) => {
    if (disabled) return;
    const isSelected = selectedSet.has(id);

    if (multiple) {
      if (isSelected) {
        onChange(selectedIds.filter((item) => item !== id));
        return;
      }
      onChange([...selectedIds, id]);
      return;
    }

    if (isSelected) {
      onChange([]);
      return;
    }
    onChange([id]);
  };

  return (
    <View style={styles.wrap}>
      {options.map((option) => {
        const isSelected = selectedSet.has(option.id);
        const isDisabled = disabled || option.disabled === true;

        return (
          <Pressable
            key={option.id}
            onPress={() => {
              if (isDisabled) return;
              onPressOption(option.id);
            }}
            style={[styles.pill, isSelected ? styles.pillActive : styles.pillInactive, isDisabled && styles.pillDisabled]}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected, disabled: isDisabled }}
          >
            <Text style={[styles.label, isSelected ? styles.labelActive : styles.labelInactive, isDisabled && styles.labelDisabled]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
