import React from 'react';
import { StyleSheet, View } from 'react-native';
import { CoachTypingDots } from './CoachTypingDots';

export function TypingIndicator() {
  return (
    <View style={styles.rowCoach}>
      <CoachTypingDots />
    </View>
  );
}

const styles = StyleSheet.create({
  rowCoach: { alignSelf: 'flex-start', maxWidth: '98%', marginBottom: 14 },
});
