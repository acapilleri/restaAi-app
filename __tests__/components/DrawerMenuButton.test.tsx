/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { DrawerMenuButton } from '../../src/components/navigation/DrawerMenuButton';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    dispatch: jest.fn(),
    getState: () => ({ type: 'stack' }),
    getParent: () => ({
      getState: () => ({ type: 'drawer' }),
      dispatch: jest.fn(),
    }),
  }),
  DrawerActions: { openDrawer: () => ({ type: 'OPEN_DRAWER' }) },
}));

describe('DrawerMenuButton', () => {
  it('renders without badge when badgeCount is 0', () => {
    let tree: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<DrawerMenuButton badgeCount={0} />);
    });
    const texts = tree!.root.findAllByType(require('react-native').Text);
    expect(texts.length).toBe(0);
  });

  it('shows badge count when badgeCount > 0', () => {
    let tree: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<DrawerMenuButton badgeCount={4} />);
    });
    const texts = tree!.root.findAllByType(require('react-native').Text);
    expect(texts.length).toBe(1);
    expect(texts[0].props.children).toBe('4');
  });

  it('shows 9+ when badgeCount > 9', () => {
    let tree: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<DrawerMenuButton badgeCount={12} />);
    });
    const texts = tree!.root.findAllByType(require('react-native').Text);
    expect(texts[0].props.children).toBe('9+');
  });
});
