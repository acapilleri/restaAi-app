/**
 * @format
 * Smoke test: App root mounts without throwing.
 * Full navigation/auth are tested in screen-specific tests.
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

// Avoid loading full App (NavigationContainer + auth + all tabs) in this smoke test
jest.mock('../src/navigation/RootNavigator', () => {
  const R = require('react');
  const { View } = require('react-native');
  return { RootNavigator: () => R.createElement(View, { testID: 'root-navigator' }) };
});

const App = require('../App').default;

test('App root renders without throwing', async () => {
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(React.createElement(App));
  });
});
