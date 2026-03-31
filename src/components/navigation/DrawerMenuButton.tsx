import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { hapticLight } from '../../utils/haptics';

type NavLike = {
  getState(): { type?: string } | undefined;
  getParent(): NavLike | undefined;
};

function findDrawerNavigation(navigation: NavLike): NavLike | null {
  let nav: NavLike | undefined = navigation;
  for (let i = 0; i < 10 && nav; i++) {
    const state = nav.getState();
    if (state?.type === 'drawer') {
      return nav;
    }
    nav = nav.getParent();
  }
  return null;
}

type Props = {
  accessibilityLabel?: string;
  /** Allinea al drawer a destra (default) o a sinistra. */
  placement?: 'leading' | 'trailing';
};

export function DrawerMenuButton({
  accessibilityLabel = 'Apri menu',
  placement = 'trailing',
}: Props) {
  const navigation = useNavigation();
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.hit, placement === 'trailing' ? styles.hitTrailing : styles.hitLeading]}
      onPress={() => {
        hapticLight();
        const drawerNav = findDrawerNavigation(navigation as NavLike);
        (drawerNav ?? navigation).dispatch(DrawerActions.openDrawer());
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      <Icon name="menu" size={24} color={colors.textPrimary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  hit: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hitLeading: { marginRight: 4 },
  hitTrailing: { marginLeft: 4 },
});
