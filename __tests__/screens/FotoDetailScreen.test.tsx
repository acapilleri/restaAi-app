/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import { FotoDetailScreen } from '../../src/screens/FotoDetailScreen';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useRoute: () => ({
      params: {
        analysis: {
          id: 4,
          taken_on: '2026-04-10',
          photo_url: 'https://cdn.example.test/body/1/detail.jpg',
          readings: {
            posture_score: 7,
            posture_notes: '',
            body_fat_estimate: '',
            muscle_distribution: '',
            strong_areas: [],
            areas_to_improve: [],
            notes: 'Note estese di supporto.',
          },
          ai_summary: 'Analisi dettagliata della foto.',
        },
      },
    }),
  };
});

describe('FotoDetailScreen', () => {
  it('renders the analysis text under the photo', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<FotoDetailScreen />);
    });

    const content = tree.root
      .findAllByType(Text)
      .map((node) => {
        const children = node.props.children;
        return Array.isArray(children) ? children.join('') : String(children ?? '');
      })
      .join(' ');

    expect(content).toContain('Analisi');
    expect(content).toContain('Analisi dettagliata della foto.');

    await ReactTestRenderer.act(async () => {
      tree.unmount();
    });
  });
});
