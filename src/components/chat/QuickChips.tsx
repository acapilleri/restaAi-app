import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';

type Props = {
  chips: string[];
  onPress: (chip: string) => void;
};

export function QuickChips({ chips, onPress }: Props) {
  if (!chips.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.wrap}
    >
      {chips.map((chip) => (
        <TouchableOpacity key={chip} style={styles.chip} onPress={() => onPress(chip)}>
          <Text style={styles.label}>{chip}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 52 },
  wrap: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(29,158,117,0.35)',
    backgroundColor: '#EDF7F3',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  label: { color: '#085041', fontSize: 12, fontWeight: '600' },
});
