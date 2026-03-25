/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { ChatScreen } from '../../src/screens/ChatScreen';
import type { AiMessage } from '../../src/types/chat';

const mockSendMessage = jest.fn();
const mockConfirmWeight = jest.fn();
const mockRefreshLatestHistory = jest.fn();
const mockLoadOlderHistory = jest.fn();

const mockBaseMessage: AiMessage = {
  id: 'm1',
  role: 'assistant',
  text: 'Ti aiuto volentieri.',
  cards: [],
  timestamp: new Date('2026-03-19T12:00:00Z'),
};

jest.mock('../../src/hooks/useChat', () => ({
  useChat: () => ({
    messages: [mockBaseMessage],
    quickChips: ['Registra peso', 'Alternative pranzo'],
    isTyping: false,
    isSending: false,
    isHistoryLoading: false,
    isHistoryRefreshing: false,
    isLoadingOlder: false,
    hasMoreHistory: false,
    loadLatestHistory: jest.fn(),
    refreshLatestHistory: (...args: unknown[]) => mockRefreshLatestHistory(...args),
    loadOlderHistory: (...args: unknown[]) => mockLoadOlderHistory(...args),
    reactionUi: { pickerForId: null },
    openReactionPicker: jest.fn(),
    closeReactionPicker: jest.fn(),
    setReaction: jest.fn(),
    sendMessage: (...args: unknown[]) => mockSendMessage(...args),
    confirmWeight: (...args: unknown[]) => mockConfirmWeight(...args),
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ChatScreen', () => {
  it('renders messages', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ChatScreen />);
    });
    const texts = tree.root.findAllByType(require('react-native').Text);
    const content = texts
      .map((t) => {
        const c = t.props.children;
        return Array.isArray(c) ? c.join('') : String(c ?? '');
      })
      .join(' ');
    expect(content).toContain('Ti aiuto volentieri.');
    await ReactTestRenderer.act(async () => {
      tree.unmount();
    });
  });

  it('has input and send button', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ChatScreen />);
    });
    const input = tree.root.findAllByType(require('react-native').TextInput);
    expect(input.length).toBeGreaterThanOrEqual(1);
    expect(input[0].props.placeholder).toMatch(/Scrivi|messaggio/);
    await ReactTestRenderer.act(async () => {
      tree.unmount();
    });
  });

  it('calls sendMessage when user submits from input', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ChatScreen />);
    });
    const input = tree.root.findByType(require('react-native').TextInput);
    await ReactTestRenderer.act(async () => {
      input.props.onChangeText('ciao');
    });
    await ReactTestRenderer.act(async () => {
      input.props.onSubmitEditing?.();
      await Promise.resolve();
    });
    expect(mockSendMessage).toHaveBeenCalledWith('ciao');
    await ReactTestRenderer.act(async () => {
      tree.unmount();
    });
  });

  it('triggers refresh and older load handlers', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ChatScreen />);
    });

    const list = tree.root.findByType(require('react-native').FlatList);
    await ReactTestRenderer.act(async () => {
      list.props.onRefresh?.();
      list.props.onScroll?.({ nativeEvent: { contentOffset: { y: 0 } } });
    });
    expect(mockRefreshLatestHistory).toHaveBeenCalled();
    expect(mockLoadOlderHistory).toHaveBeenCalled();
    await ReactTestRenderer.act(async () => {
      tree.unmount();
    });
  });

  it('does not load older messages when not at top', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ChatScreen />);
    });

    const list = tree.root.findByType(require('react-native').FlatList);
    await ReactTestRenderer.act(async () => {
      list.props.onScroll?.({
        nativeEvent: {
          contentOffset: { y: 180 },
          contentSize: { height: 600 },
          layoutMeasurement: { height: 300 },
        },
      });
    });
    expect(mockLoadOlderHistory).not.toHaveBeenCalled();

    await ReactTestRenderer.act(async () => {
      tree.unmount();
    });
  });
});
