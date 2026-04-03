/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
// eslint-disable-next-line @react-native/no-deep-imports
import Alert from 'react-native/Libraries/Alert/Alert';
import { launchCamera } from 'react-native-image-picker';
import { FotoScreen } from '../../src/screens/FotoScreen';

const mockGetBodyAnalyses = jest.fn();
const mockUploadAndAnalyze = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ navigate: mockNavigate }),
  };
});

jest.mock('../../src/api/bodyAnalysis', () => ({
  getBodyAnalyses: (...args: unknown[]) => mockGetBodyAnalyses(...args),
  uploadAndAnalyze: (...args: unknown[]) => mockUploadAndAnalyze(...args),
}));

jest.mock('../../src/components/navigation/DrawerMenuButtonWithBadge', () => ({
  DrawerMenuButtonWithBadge: () => null,
}));

describe('FotoScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders latest photo summary without posture or body fat in the UI', async () => {
    mockGetBodyAnalyses.mockResolvedValue([
      {
        id: 2,
        taken_on: '2026-04-08',
        photo_url: 'https://cdn.example.test/body/1/latest.jpg',
        readings: {
          posture_score: 8,
          posture_notes: 'Spalle allineate.',
          body_fat_estimate: '15-20%',
          muscle_distribution: 'Buona definizione generale.',
          strong_areas: ['spalle'],
          areas_to_improve: ['core'],
          notes: 'Continua cosi.',
        },
        ai_summary: 'Ottima simmetria generale.',
      },
      {
        id: 1,
        taken_on: '2026-04-01',
        photo_url: 'https://cdn.example.test/body/1/first.jpg',
        readings: {
          posture_score: 6,
          posture_notes: 'Leggera anteposizione.',
          body_fat_estimate: '18-22%',
          muscle_distribution: 'Base presente.',
          strong_areas: ['gambe'],
          areas_to_improve: ['schiena'],
          notes: 'Buon punto di partenza.',
        },
        ai_summary: 'Prima lettura.',
      },
    ]);

    let tree: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<FotoScreen />);
      await Promise.resolve();
    });

    const content = tree.root
      .findAllByType(Text)
      .map((node) => {
        const children = node.props.children;
        return Array.isArray(children) ? children.join('') : String(children ?? '');
      })
      .join(' ');

    expect(content).toContain('Foto corpo');
    expect(content).toContain('2 foto');
    expect(content).toContain('Ottima simmetria generale.');
    expect(content).toContain('Storia foto');
    expect(content).not.toContain('Postura');
    expect(content).not.toContain('Massa grassa');

    await ReactTestRenderer.act(async () => {
      tree.unmount();
    });
  });

  it('uploads a captured photo through the camera flow', async () => {
    mockGetBodyAnalyses.mockResolvedValue([]);
    mockUploadAndAnalyze.mockResolvedValue({
      id: 3,
      taken_on: '2026-04-10',
      photo_url: 'https://cdn.example.test/body/1/uploaded.jpg',
      readings: {
        posture_score: 7,
        posture_notes: '',
        body_fat_estimate: '16-20%',
        muscle_distribution: '',
        strong_areas: [],
        areas_to_improve: [],
        notes: '',
      },
      ai_summary: 'Nuova lettura completata.',
    });

    (launchCamera as jest.Mock).mockImplementation(
      (_options: unknown, callback: (response: unknown) => void) => {
        callback({
          assets: [
            {
              uri: 'file:///body.jpg',
              fileName: 'body.jpg',
              type: 'image/jpeg',
            },
          ],
        });
      },
    );

    let tree: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<FotoScreen />);
      await Promise.resolve();
    });

    const uploadButton = tree.root.findAllByType(TouchableOpacity).find((node) => {
      const texts = node.findAllByType(Text);
      return texts.some((textNode) => textNode.props.children === 'fai foto');
    });

    expect(uploadButton).toBeDefined();

    await ReactTestRenderer.act(async () => {
      uploadButton?.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockUploadAndAnalyze).toHaveBeenCalledWith({
      uri: 'file:///body.jpg',
      fileName: 'body.jpg',
      type: 'image/jpeg',
    });
    expect(mockGetBodyAnalyses).toHaveBeenCalledTimes(2);
    expect(Alert.alert).toHaveBeenCalledWith('Analisi completata', 'Lettura salvata.');

    await ReactTestRenderer.act(async () => {
      tree.unmount();
    });
  });

  it('opens detail when tapping a photo in history', async () => {
    mockGetBodyAnalyses.mockResolvedValue([
      {
        id: 2,
        taken_on: '2026-04-08',
        photo_url: 'https://cdn.example.test/body/1/latest.jpg',
        readings: {
          posture_score: 8,
          posture_notes: 'Spalle allineate.',
          body_fat_estimate: '15-20%',
          muscle_distribution: 'Buona definizione generale.',
          strong_areas: ['spalle'],
          areas_to_improve: ['core'],
          notes: 'Continua cosi.',
        },
        ai_summary: 'Ottima simmetria generale.',
      },
    ]);

    let tree: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<FotoScreen />);
      await Promise.resolve();
    });

    const historyCard = tree.root.findAllByType(TouchableOpacity).find((node) => {
      const texts = node.findAllByType(Text);
      return texts.some((textNode) => textNode.props.children === 'Apri analisi');
    });

    expect(historyCard).toBeDefined();

    await ReactTestRenderer.act(async () => {
      historyCard?.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('FotoDetail', {
      analysis: expect.objectContaining({
        id: 2,
        photo_url: 'https://cdn.example.test/body/1/latest.jpg',
      }),
    });

    await ReactTestRenderer.act(async () => {
      tree.unmount();
    });
  });
});
