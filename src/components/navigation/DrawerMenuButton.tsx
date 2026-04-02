import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { hapticLight } from '../../utils/haptics';

type NavLike = {
  getState(): { type?: string } | undefined;
  getParent(): NavLike | undefined;
  dispatch(action: unknown): void;
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
  /** Spunti motivazionali non letti (da GET /profile). */
  badgeCount?: number;
};

export function DrawerMenuButton({
  accessibilityLabel = 'Apri menu',
  placement = 'trailing',
  badgeCount = 0,
}: Props) {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const showBadge = badgeCount > 0;
  const badgeLabel = badgeCount > 9 ? '9+' : String(badgeCount);
  const badgeStyles = useMemo(
    () =>
      StyleSheet.create({
        badge: {
          position: 'absolute',
          top: -2,
          right: -4,
          minWidth: 18,
          height: 18,
          paddingHorizontal: badgeLabel.length > 1 ? 3 : 0,
          borderRadius: 9,
          backgroundColor: '#E53935',
          alignItems: 'center',
          justifyContent: 'center',
        },
        badgeText: {
          color: '#FFFFFF',
          fontSize: 10,
          fontWeight: '700',
        },
      }),
    [badgeLabel.length],
  );

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
      <View style={styles.iconWrap}>
        <Icon name="menu" size={24} color={colors.textPrimary} />
        {showBadge ? (
          <View style={badgeStyles.badge} accessibilityElementsHidden>
            <Text style={badgeStyles.badgeText}>{badgeLabel}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hit: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hitLeading: { marginRight: 4 },
  hitTrailing: { marginLeft: 4 },
});
