import React, { useCallback, useMemo } from 'react';
import { Linking, Platform, StyleSheet, Text } from 'react-native';
import Markdown, { MarkdownIt } from 'react-native-markdown-display';
import { colors } from '../../theme/colors';
import { softWrapText } from '../../utils/softWrap';

type Props = {
  text: string;
  isUser: boolean;
};

/** markdown-it senza HTML grezzo (sicurezza). Istanza stabile per evitare re-parse inutili. */
function useSafeMarkdownIt() {
  return useMemo(
    () =>
      new MarkdownIt({
        html: false,
        linkify: true,
        typographer: true,
      }),
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
  const rawContent = typeof text === 'string' ? text : '';
  if (!rawContent.trim()) return null;
  const content = softWrapText(rawContent);

  const markdownit = useSafeMarkdownIt();

  const handleLinkPress = useCallback(async (url: string) => {
    if (!url || !/^https?:\/\//i.test(url)) return false;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return true;
    }
    return false;
  }, []);

  const markdownStyle = isUser ? userStyles : assistantStyles;

  return (
    <MarkdownErrorBoundary text={content} isUser={isUser}>
      <Markdown markdownit={markdownit} style={markdownStyle} onLinkPress={handleLinkPress}>
        {content}
      </Markdown>
    </MarkdownErrorBoundary>
  );
}

const baseMarkdownStyles = StyleSheet.create({
  body: {
    marginTop: 0,
    marginBottom: 0,
    flexShrink: 1,
    minWidth: 0,
    ...(Platform.OS === 'android' ? { includeFontPadding: false, textAlignVertical: 'center' } : null),
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 6,
  },
  text: {
    flexShrink: 1,
    minWidth: 0,
    ...(Platform.OS === 'android' ? { includeFontPadding: false, textAlignVertical: 'center' } : null),
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
    fontWeight: '700',
    marginTop: 0,
    marginBottom: 6,
  },
  heading2: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
    marginTop: 0,
    marginBottom: 6,
  },
  heading3: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: 0,
    marginBottom: 6,
  },
  strong: {
    fontWeight: '700',
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
});

const assistantStyles = StyleSheet.create({
  ...baseMarkdownStyles,
  body: {
    ...baseMarkdownStyles.body,
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
  },
  text: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
  },
  link: {
    color: '#1565C0',
    textDecorationLine: 'underline',
  },
  code_inline: {
    ...baseMarkdownStyles.code_inline,
    backgroundColor: 'rgba(0,0,0,0.06)',
    color: colors.textPrimary,
  },
  fence: {
    ...baseMarkdownStyles.fence,
    backgroundColor: 'rgba(0,0,0,0.06)',
    color: colors.textPrimary,
  },
});

const userStyles = StyleSheet.create({
  ...baseMarkdownStyles,
  body: {
    ...baseMarkdownStyles.body,
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
  },
  text: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
  },
  link: {
    color: colors.primaryMuted,
    textDecorationLine: 'underline',
  },
  code_inline: {
    ...baseMarkdownStyles.code_inline,
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: '#fff',
  },
  fence: {
    ...baseMarkdownStyles.fence,
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: '#fff',
  },
});

export function ChatTextFallback({ text, isUser }: Props) {
  return <Text style={isUser ? fallbackStyles.userText : fallbackStyles.aiText}>{text}</Text>;
}

const fallbackStyles = StyleSheet.create({
  aiText: { fontSize: 13, color: '#111', lineHeight: 18 },
  userText: { fontSize: 13, color: '#fff', lineHeight: 18 },
});
