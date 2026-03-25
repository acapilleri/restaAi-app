import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { AiMessage, MessageReaction } from '../../types/chat';
import { MacroSummaryCard } from './cards/MacroSummaryCard';
import { MealProgressCard } from './cards/MealProgressCard';
import { WeightConfirmCard } from './cards/WeightConfirmCard';
import { RecipeAlternativeCard } from './cards/RecipeAlternativeCard';
import { ChatMarkdown } from './ChatMarkdown';
import { softWrapText } from '../../utils/softWrap';
import { ReactionOverlay } from './ReactionOverlay';

type Props = {
  message: AiMessage;
  onConfirmWeight: (kg: number) => Promise<void>;
  reactionPickerOpen: boolean;
  onOpenReactionPicker: (messageId: string) => void;
  onCloseReactionPicker: () => void;
  onSetReaction: (messageId: string, reaction: MessageReaction | null) => void;
};

export function MessageRenderer({
  message,
  onConfirmWeight,
  reactionPickerOpen,
  onOpenReactionPicker,
  onCloseReactionPicker,
  onSetReaction,
}: Props) {
  const isUser = message.role === 'user';
  const text = typeof message.text === 'string' ? softWrapText(message.text) : '';
  const canReact = message.role === 'assistant';

  const pressAnim = useRef(new Animated.Value(0)).current; // 0 idle -> 1 active

  useEffect(() => {
    Animated.spring(pressAnim, {
      toValue: reactionPickerOpen ? 1 : 0,
      useNativeDriver: true,
      damping: 18,
      stiffness: 220,
      mass: 0.9,
    }).start();
  }, [pressAnim, reactionPickerOpen]);

  const bubbleAnimatedStyle = useMemo(
    () => ({
      transform: [
        { scale: pressAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] }) },
        { translateY: pressAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) },
      ],
    }),
    [pressAnim],
  );

  const liftStyle = useMemo(
    () =>
      reactionPickerOpen
        ? Platform.select({
            ios: styles.bubbleLiftIOS,
            android: styles.bubbleLiftAndroid,
            default: null,
          })
        : null,
    [reactionPickerOpen],
  );

  const overlayEmoji = message.reaction === 'like' ? '❤️' : message.reaction === 'dislike' ? '👎' : null;

  return (
    <View style={[styles.row, isUser && styles.rowUser]}>
      {text ? (
        <View style={[styles.messageWrap, isUser ? styles.messageWrapUser : styles.messageWrapAi]}>
          <Pressable
            onLongPress={() => (canReact ? onOpenReactionPicker(message.id) : undefined)}
            onPress={() => (reactionPickerOpen ? onCloseReactionPicker() : undefined)}
            delayLongPress={250}
            disabled={!canReact && !reactionPickerOpen}
          >
            <View style={[styles.relative, isUser ? styles.relativeUser : styles.relativeAi]}>
              <ReactionOverlay
                open={canReact && reactionPickerOpen}
                value={message.reaction ?? null}
                onSelect={(r) => onSetReaction(message.id, r)}
                onClear={message.reaction ? () => onSetReaction(message.id, null) : undefined}
              />

              <Animated.View
                style={[
                  styles.bubble,
                  isUser ? styles.bubbleUser : styles.bubbleAi,
                  liftStyle,
                  bubbleAnimatedStyle,
                ]}
              >
                {isUser ? (
                  <Text style={styles.textUser}>{text}</Text>
                ) : (
                  <ChatMarkdown text={text} isUser={false} />
                )}

                {canReact && overlayEmoji ? (
                  <View style={styles.reactionBadgeWrap} pointerEvents="none">
                    <View style={styles.reactionBadge}>
                      <Text style={styles.reactionBadgeText}>
                        {overlayEmoji}
                        {message.reactionPending ? '…' : ''}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </Animated.View>
            </View>
          </Pressable>

          <Text style={[styles.timestamp, isUser ? styles.timestampUser : styles.timestampAi]}>
            {message.timestamp.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      ) : null}

      {message.cards.map((card, i) => {
        switch (card.type) {
          case 'macro_summary':
            return <MacroSummaryCard key={`${message.id}-macro-${i}`} data={card.data} />;
          case 'meal_progress':
            return <MealProgressCard key={`${message.id}-meal-${i}`} data={card.data} />;
          case 'weight_confirm':
            return (
              <WeightConfirmCard
                key={`${message.id}-weight-${i}`}
                data={card.data}
                onConfirm={onConfirmWeight}
              />
            );
          case 'recipe_alternative':
            return <RecipeAlternativeCard key={`${message.id}-recipe-${i}`} data={card.data} />;
          default:
            return null;
        }
      })}

    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'flex-start', marginBottom: 8 },
  rowUser: { alignItems: 'flex-end' },
  messageWrap: {
    width: '78%',
    minWidth: 0,
  },
  messageWrapAi: { alignSelf: 'flex-start' },
  messageWrapUser: { alignSelf: 'flex-end' },
  relative: { position: 'relative', width: '100%' },
  relativeAi: { alignSelf: 'flex-start' },
  relativeUser: { alignSelf: 'flex-end' },
  bubble: {
    width: '100%',
    padding: 10,
    borderRadius: 16,
    flexShrink: 1,
    minWidth: 0,
  },
  bubbleAi: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.07)',
  },
  bubbleLiftIOS: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
  },
  bubbleLiftAndroid: {
    elevation: 10,
  },
  bubbleUser: {
    backgroundColor: '#1D9E75',
    borderRadius: 16,
    borderBottomRightRadius: 4,
    alignSelf: 'flex-end',
  },
  textAi: { fontSize: 13, color: '#111', lineHeight: 18 },
  textUser: { fontSize: 13, color: '#fff', lineHeight: 18, flexShrink: 1, minWidth: 0 },
  reactionBadgeWrap: {
    position: 'absolute',
    right: -6,
    bottom: -10,
  },
  reactionBadge: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.12)',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  reactionBadgeText: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.7)',
    fontWeight: '700',
  },
  timestamp: { fontSize: 10, color: 'rgba(0,0,0,0.35)', marginTop: 3, paddingHorizontal: 4 },
  timestampAi: { alignSelf: 'flex-start' },
  timestampUser: { alignSelf: 'flex-end' },
});
