import React, { useCallback, useMemo } from 'react';
import { Linking, Platform, StyleSheet, Text, type TextStyle } from 'react-native';
import Markdown, { MarkdownIt } from 'react-native-markdown-display';
import { useTheme } from '../../context/ThemeContext';
import { softWrapText } from '../../utils/softWrap';

type Props = {
  text: string;
  isUser: boolean;
};

/** markdown-it senza HTML grezzo (sicurezza). Istanza stabile per evitare re-parse inutili. */
function useSafeMarkdownIt() {
  return useMemo(
    () => {
      const md = new MarkdownIt({
        html: false,
        linkify: true,
        typographer: true,
      });
      // Allow custom app deep links to be recognized in plain text.
      md.linkify.add('restaai:', 'http:');
      md.linkify.add('resta:', 'http:');
      return md;
    },
    [],
  );
}

type BoundaryProps = Props & { children: React.ReactNode };

type BoundaryState = { hasError: boolean };

class MarkdownErrorBoundary extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): Partial<BoundaryState> {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <ChatTextFallback text={this.props.text} isUser={this.props.isUser} />;
    }
    return this.props.children;
  }
}

export function ChatMarkdown({ text, isUser }: Props) {
  const { colors } = useTheme();
  const rawContent = typeof text === 'string' ? text : '';
  if (!rawContent.trim()) return null;
  const content = softWrapText(rawContent);

  const markdownit = useSafeMarkdownIt();

  const markdownStyle = useMemo(() => {
    const baseMarkdownStyles = {
      body: {
        marginTop: 0,
        marginBottom: 0,
        flexShrink: 1,
        minWidth: 0,
        ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
      },
      paragraph: {
        marginTop: 0,
        marginBottom: 6,
      },
      text: {
        flexShrink: 1,
        minWidth: 0,
        ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
      },
      bullet_list: {
        marginTop: 0,
        marginBottom: 6,
      },
      ordered_list: {
        marginTop: 0,
        marginBottom: 6,
      },
      list_item: {
        marginTop: 0,
        marginBottom: 2,
      },
      heading1: {
        fontSize: 17,
        lineHeight: 22,
        fontWeight: '700' as TextStyle['fontWeight'],
        marginTop: 0,
        marginBottom: 6,
      },
      heading2: {
        fontSize: 16,
        lineHeight: 21,
        fontWeight: '700' as TextStyle['fontWeight'],
        marginTop: 0,
        marginBottom: 6,
      },
      heading3: {
        fontSize: 15,
        lineHeight: 20,
        fontWeight: '700' as TextStyle['fontWeight'],
        marginTop: 0,
        marginBottom: 6,
      },
      strong: {
        fontWeight: '700' as TextStyle['fontWeight'],
      },
      em: {
        fontStyle: 'italic',
      },
      code_inline: {
        fontFamily: 'Menlo',
        fontSize: 12,
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
      },
      fence: {
        fontFamily: 'Menlo',
        fontSize: 12,
        lineHeight: 16,
        padding: 8,
        borderRadius: 8,
      },
    };

    const codeBg = isUser ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)';
    const textUser = colors.textOnPrimary;
    const textAi = colors.textPrimary;

    if (isUser) {
      return StyleSheet.create({
        ...baseMarkdownStyles,
        body: {
          ...baseMarkdownStyles.body,
          color: textUser,
          fontSize: 16,
          lineHeight: 24,
        },
        text: {
          color: textUser,
          fontSize: 16,
          lineHeight: 24,
        },
        link: {
          color: colors.primaryMuted,
          textDecorationLine: 'underline',
        },
        code_inline: {
          ...baseMarkdownStyles.code_inline,
          backgroundColor: codeBg,
          color: textUser,
        },
        fence: {
          ...baseMarkdownStyles.fence,
          backgroundColor: codeBg,
          color: textUser,
        },
      } as Parameters<typeof StyleSheet.create>[0]);
    }

    return StyleSheet.create({
      ...baseMarkdownStyles,
      body: {
        ...baseMarkdownStyles.body,
        color: textAi,
        fontSize: 16,
        lineHeight: 24,
      },
      text: {
        color: textAi,
        fontSize: 16,
        lineHeight: 24,
      },
      link: {
        color: colors.markdownLink,
        textDecorationLine: 'underline',
      },
      code_inline: {
        ...baseMarkdownStyles.code_inline,
        backgroundColor: codeBg,
        color: textAi,
      },
      fence: {
        ...baseMarkdownStyles.fence,
        backgroundColor: codeBg,
        color: textAi,
      },
    } as Parameters<typeof StyleSheet.create>[0]);
  }, [colors, isUser]);

  const normalizeDeepLink = useCallback((input: string) => {
    // `softWrapText()` inserts ZWSP for layout; markdown may pass them URL-encoded.
    const cleaned = input
      .replace(/%E2%80%8B/gi, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim();
  
    const compact = cleaned.replace(/\s+/g, '');
    if (/^restaai:\/*dieta\/?$/i.test(compact) || /^resta:\/*dieta\/?$/i.test(compact)) {
      return 'restaai://dieta';
    }

  
    if (/^restaai:dieta\/?$/i.test(compact) || /^resta:dieta\/?$/i.test(compact)) {
      return 'restaai://dieta';
    }
  }, []);

  const handleLinkPress = useCallback((url: string) => {
    const raw = typeof url === 'string' ? url.trim() : '';
    if (!raw) return false;
    const normalizedUrl = normalizeDeepLink(raw);
    Linking.openURL('restaai://dieta')
    void Linking.openURL('restaai://dieta').catch(() => {
      // no-op: keep markdown interaction stable even for malformed links
    });
    // `react-native-markdown-display`: return false when link opening is handled manually.
    return false;
  }, [normalizeDeepLink]);

  return (
    <MarkdownErrorBoundary text={content} isUser={isUser}>
      <Markdown markdownit={markdownit} style={markdownStyle} onLinkPress={handleLinkPress}>
        {content}
      </Markdown>
    </MarkdownErrorBoundary>
  );
}

export function ChatTextFallback({ text, isUser }: Props) {
  const { colors } = useTheme();
  const style = useMemo(
    () => ({
      fontSize: 16,
      lineHeight: 24,
      color: isUser ? colors.textOnPrimary : colors.textPrimary,
    }),
    [colors.textOnPrimary, colors.textPrimary, isUser],
  );
  return <Text style={style}>{text}</Text>;
}
