/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import { FotoDetailScreen } from '../../src/screens/FotoDetailScreen';

jest.mock('../../src/api/bodyAnalysis', () => ({
  getBodyAnalyses: jest.fn().mockResolvedValue([]),
  deleteBodyAnalysis: jest.fn(),
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      goBack: jest.fn(),
    }),
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
            waist_to_hip_ratio_estimate: '',
            waist_to_shoulder_ratio_estimate: '',
            body_shape_note: '',
            muscle_distribution: '',
            strong_areas: [],
            areas_to_improve: [],
            overall_progress_note: '',
            suggested_focus: '',
            notes: 'Note estese di supporto.',
          },
          ai_summary: 'Analisi dettagliata della foto.',
          comparison: {
            comparison_summary: 'Rispetto alla scorsa foto, spalle più aperte.',
            progress_summary: '',
            progress_trend: 'miglioramento',
          },
        },
      },
    }),
    useFocusEffect: (callback: () => void | (() => void)) => {
      const { useEffect } = require('react');
      useEffect(() => {
        return callback();
      }, []);
    },
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

    expect(content).toContain('Riepilogo');
    expect(content).toContain('Analisi dettagliata della foto.');
    expect(content).toContain('Tabella parametri');
    expect(content).toContain('Confronto con le foto precedenti');
    expect(content).toContain('Rispetto alla scorsa foto');
    expect(content).toContain('Punteggio postura');
    expect(content).toContain('7/10');
    expect(content).toContain('Rimuovi questo Body Check');

    await ReactTestRenderer.act(async () => {
      tree.unmount();
    });
  });
});
