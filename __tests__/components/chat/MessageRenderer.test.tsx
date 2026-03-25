import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { MessageRenderer } from '../../../src/components/chat/MessageRenderer';
import type { AiMessage } from '../../../src/types/chat';

describe('MessageRenderer', () => {
  function flattenStyle(input: unknown): Record<string, unknown> {
    if (!input) return {};
    if (Array.isArray(input)) {
      return input.reduce<Record<string, unknown>>((acc, item) => ({ ...acc, ...flattenStyle(item) }), {});
    }
    return typeof input === 'object' ? (input as Record<string, unknown>) : {};
  }

  it('renders assistant markdown text', async () => {
    const message: AiMessage = {
      id: 'markdown-msg',
      role: 'assistant',
      text: [
        '# Piano',
        '',
        '**Proteine** e _carboidrati_',
        '',
        '- Uova',
        '- Riso',
        '',
        'Link: [scheda](https://example.com)',
        '',
        '```',
        'meal: pranzo',
        'kcal: 520',
        '```',
      ].join('\n'),
      timestamp: new Date('2026-03-19T12:00:00Z'),
      cards: [],
    };

    let tree: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <MessageRenderer
          message={message}
          onConfirmWeight={jest.fn()}
          reactionPickerOpen={false}
          onOpenReactionPicker={jest.fn()}
          onCloseReactionPicker={jest.fn()}
          onSetReaction={jest.fn()}
        />,
      );
    });

    const textDump = tree.root
      .findAllByType(require('react-native').Text)
      .map((t) =>
        Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? ''),
      )
      .join(' ');
    const normalized = textDump.replace(/\u200B/g, '');

    expect(normalized).toContain('Piano');
    expect(normalized).toContain('Proteine');
    expect(normalized).toContain('carboidrati');
    expect(normalized).toContain('Uova');
    expect(normalized).toContain('scheda');
    expect(normalized).toContain('meal: pranzo');
  });

  it('soft-wraps long tokens (URLs) to avoid clipping', async () => {
    const longUrl = 'https://example.com/this/is/a/very/very/very/long/path?with=query&and=more';
    const message: AiMessage = {
      id: 'long-url-msg',
      role: 'user',
      text: `Guarda ${longUrl} ok`,
      timestamp: new Date('2026-03-19T12:00:00Z'),
      cards: [],
    };

    let tree: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <MessageRenderer
          message={message}
          onConfirmWeight={jest.fn()}
          reactionPickerOpen={false}
          onOpenReactionPicker={jest.fn()}
          onCloseReactionPicker={jest.fn()}
          onSetReaction={jest.fn()}
        />,
      );
    });

    const allText = tree.root
      .findAllByType(require('react-native').Text)
      .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
      .join(' ');
    const normalized = allText.replace(/\u200B/g, '');

    // Visible characters should still be present.
    expect(normalized).toContain('Guarda');
    expect(normalized).toContain('https://example.com');
    expect(normalized).toContain('ok');
  });

  it('renders recipe alternative card content', async () => {
    const message: AiMessage = {
      id: 'recipe-msg',
      role: 'assistant',
      text: 'Ti propongo **un alternativa**.',
      timestamp: new Date('2026-03-19T12:00:00Z'),
      cards: [
        {
          type: 'recipe_alternative',
          data: {
            pasto: 'Pranzo',
            nome: 'Insalata tonno e ceci',
            ingredienti: 'Tonno 200g · Ceci 150g',
            proteine: 42,
            carboidrati: 38,
            grassi: 22,
            kcal: 518,
          },
        },
      ],
    };

    let tree: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <MessageRenderer
          message={message}
          onConfirmWeight={jest.fn()}
          reactionPickerOpen={false}
          onOpenReactionPicker={jest.fn()}
          onCloseReactionPicker={jest.fn()}
          onSetReaction={jest.fn()}
        />,
      );
    });

    const textDump = tree.root
      .findAllByType(require('react-native').Text)
      .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
      .join(' ');
    expect(textDump).toContain('Insalata tonno e ceci');
    expect(textDump).toContain('518 kcal');
    expect(textDump).toContain('un alternativa');
  });

  it('confirms weight when user taps conferma', async () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined);
    const message: AiMessage = {
      id: 'weight-msg',
      role: 'assistant',
      text: 'Confermi il peso?',
      timestamp: new Date('2026-03-19T12:00:00Z'),
      cards: [
        {
          type: 'weight_confirm',
          data: { kg: 101, data: '2026-03-19' },
        },
      ],
    };

    let tree: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <MessageRenderer
          message={message}
          onConfirmWeight={onConfirm}
          reactionPickerOpen={false}
          onOpenReactionPicker={jest.fn()}
          onCloseReactionPicker={jest.fn()}
          onSetReaction={jest.fn()}
        />,
      );
    });

    const buttons = tree.root.findAllByType(require('react-native').TouchableOpacity);
    expect(buttons.length).toBeGreaterThan(0);
    await ReactTestRenderer.act(async () => {
      buttons[0].props.onPress();
      await Promise.resolve();
    });
    expect(onConfirm).toHaveBeenCalledWith(101);
  });

  it('opens reaction picker on long press for assistant messages', async () => {
    const onOpenReactionPicker = jest.fn();
    const message: AiMessage = {
      id: 'assistant-1',
      role: 'assistant',
      text: 'Ciao',
      timestamp: new Date('2026-03-19T12:00:00Z'),
      cards: [],
    };

    let tree: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <MessageRenderer
          message={message}
          onConfirmWeight={jest.fn()}
          reactionPickerOpen={false}
          onOpenReactionPicker={onOpenReactionPicker}
          onCloseReactionPicker={jest.fn()}
          onSetReaction={jest.fn()}
        />,
      );
    });

    const nodesWithLongPress = tree.root.findAll(
      (n) => typeof n.props?.onLongPress === 'function',
    );
    expect(nodesWithLongPress.length).toBeGreaterThan(0);
    await ReactTestRenderer.act(async () => {
      nodesWithLongPress[0].props.onLongPress?.();
    });
    expect(onOpenReactionPicker).toHaveBeenCalledWith('assistant-1');
  });

  it('calls onSetReaction when user selects a reaction from overlay', async () => {
    const onSetReaction = jest.fn();
    const message: AiMessage = {
      id: 'assistant-2',
      role: 'assistant',
      text: 'Ok',
      timestamp: new Date('2026-03-19T12:00:00Z'),
      cards: [],
    };

    let tree: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <MessageRenderer
          message={message}
          onConfirmWeight={jest.fn()}
          reactionPickerOpen={true}
          onOpenReactionPicker={jest.fn()}
          onCloseReactionPicker={jest.fn()}
          onSetReaction={onSetReaction}
        />,
      );
    });

    const heartButtons = tree.root.findAll(
      (n) => n.props?.accessibilityLabel === 'Metti cuore' && typeof n.props?.onPress === 'function',
    );
    expect(heartButtons.length).toBeGreaterThan(0);
    await ReactTestRenderer.act(async () => {
      heartButtons[0].props.onPress();
    });
    expect(onSetReaction).toHaveBeenCalledWith('assistant-2', 'like');
  });

  it('keeps user messages aligned to the right', async () => {
    const message: AiMessage = {
      id: 'user-align-1',
      role: 'user',
      text: 'Messaggio utente',
      timestamp: new Date('2026-03-19T12:00:00Z'),
      cards: [],
    };

    let tree: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <MessageRenderer
          message={message}
          onConfirmWeight={jest.fn()}
          reactionPickerOpen={false}
          onOpenReactionPicker={jest.fn()}
          onCloseReactionPicker={jest.fn()}
          onSetReaction={jest.fn()}
        />,
      );
    });

    const rowCandidates = tree.root.findAll(
      (n) => n.type === require('react-native').View && n.props?.style,
    );
    const hasRightAlignedRow = rowCandidates.some((n) => {
      const style = flattenStyle(n.props.style);
      return style.alignItems === 'flex-end';
    });

    expect(hasRightAlignedRow).toBe(true);
  });

  it('uses fixed width container and left-aligned timestamp for assistant', async () => {
    const message: AiMessage = {
      id: 'assistant-history-1',
      role: 'assistant',
      text: 'Messaggio storico assistant',
      timestamp: new Date('2026-03-19T12:00:00Z'),
      cards: [],
    };

    let tree: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <MessageRenderer
          message={message}
          onConfirmWeight={jest.fn()}
          reactionPickerOpen={false}
          onOpenReactionPicker={jest.fn()}
          onCloseReactionPicker={jest.fn()}
          onSetReaction={jest.fn()}
        />,
      );
    });

    const viewsWithStyle = tree.root.findAll(
      (n) => n.type === require('react-native').View && n.props?.style,
    );
    const hasFixedWidthWrap = viewsWithStyle.some((n) => {
      const style = flattenStyle(n.props.style);
      return style.width === '78%';
    });
    expect(hasFixedWidthWrap).toBe(true);

    const timestamps = tree.root.findAllByType(require('react-native').Text).filter((n) => {
      const c = n.props.children;
      const value = Array.isArray(c) ? c.join('') : String(c ?? '');
      return /^\d{2}:\d{2}$/.test(value);
    });
    expect(timestamps.length).toBeGreaterThan(0);
    const tsStyle = flattenStyle(timestamps[0].props.style);
    expect(tsStyle.alignSelf).toBe('flex-start');
  });
});
