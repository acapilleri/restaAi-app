import React from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { hapticLight } from '../utils/haptics';

type Props = {
  liked: boolean;
  loading?: boolean;
  onPress: () => void;
};

export function RecipeLikeButton({ liked, loading, onPress }: Props) {
  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={() => {
        hapticLight();
        onPress();
      }}
      disabled={liked || loading}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={liked ? 'Preferenza salvata' : 'Mi piace questa ricetta'}
      accessibilityState={{ disabled: liked || loading, selected: liked }}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#888" />
      ) : (
        <Icon name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? '#E53935' : '#888'} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
