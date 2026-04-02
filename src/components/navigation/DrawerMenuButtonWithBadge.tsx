import React, { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { DrawerMenuButton } from './DrawerMenuButton';
import { useProfileQuery } from '../../hooks/useProfileQuery';

type Props = {
  accessibilityLabel?: string;
  placement?: 'leading' | 'trailing';
};

/**
 * Menu drawer con badge sul conteggio spunti motivazionali non letti (GET /profile).
 */
export function DrawerMenuButtonWithBadge(props: Props) {
  const { data, refetch } = useProfileQuery();
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );
  const badgeCount = data?.profile?.unread_nudge_count ?? 0;
  return <DrawerMenuButton {...props} badgeCount={badgeCount} />;
}
