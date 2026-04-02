import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ConfirmChatPayload } from '../../api/chat';
import type { AiMessage, MessageReaction } from '../../types/chat';
import { MacroSummaryCard } from './cards/MacroSummaryCard';
import { MealProgressCard } from './cards/MealProgressCard';
import { ConfirmActionCard } from './cards/ConfirmActionCard';
import { BodyFatConfirmCard } from './cards/BodyFatConfirmCard';
import { WaistConfirmCard } from './cards/WaistConfirmCard';
import { WeightConfirmCard } from './cards/WeightConfirmCard';
import {
  BirthDateConfirmCard,
  GoalWeightConfirmCard,
  HeightConfirmCard,
  IntolerancesConfirmCard,
} from './cards/ProfileConfirmCards';
import { RecipeAlternativeCard } from './cards/RecipeAlternativeCard';
import { NearbyRestaurantRecommendationCard } from './cards/NearbyRestaurantRecommendationCard';
import { ChatMarkdown } from './ChatMarkdown';
import { softWrapText } from '../../utils/softWrap';
import { ReactionOverlay } from './ReactionOverlay';
import { useTheme } from '../../context/ThemeContext';

type Props = {
  message: AiMessage;
  onConfirmChatAction: (payload: ConfirmChatPayload) => Promise<void>;
  reactionPickerOpen: boolean;
  onOpenReactionPicker: (messageId: string) => void;
  onCloseReactionPicker: () => void;
  onSetReaction: (messageId: string, reaction: MessageReaction | null) => void;
};

export function MessageRenderer({
  message,
  onConfirmChatAction,
  reactionPickerOpen,
  onOpenReactionPicker,
  onCloseReactionPicker,
  onSetReaction,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { alignItems: 'flex-start', marginBottom: 14 },
        rowUser: { alignItems: 'flex-end' },
        messageWrap: {
          maxWidth: '98%',
          width: '100%',
          minWidth: 0,
        },
        messageWrapAi: { alignSelf: 'flex-start' },
        messageWrapUser: { alignSelf: 'flex-end', width: 'auto', maxWidth: '85%' },
        relative: { position: 'relative', width: '100%' },
        relativeAi: { alignSelf: 'flex-start' },
        relativeUser: { alignSelf: 'flex-end', width: 'auto' },
        bubble: {
          width: '100%',
          paddingVertical: 13,
          paddingHorizontal: 16,
          borderRadius: 18,
          flexShrink: 1,
          minWidth: 0,
        },
        bubbleAi: {
          backgroundColor: colors.bgCard,
          borderRadius: 18,
          borderBottomLeftRadius: 5,
          borderWidth: 1,
          borderColor: colors.chatBubbleBorder,
        },
        bubbleAiIos: {
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
        },
        bubbleAiAndroid: {
          elevation: 1,
        },
        bubbleLiftIOS: {
          shadowColor: colors.shadow,
          shadowOpacity: 0.12,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 10 },
        },
        bubbleLiftAndroid: {
          elevation: 10,
        },
        bubbleUser: {
          backgroundColor: colors.primary,
          borderRadius: 18,
          borderBottomRightRadius: 5,
          alignSelf: 'flex-end',
          width: 'auto',
          maxWidth: '100%',
        },
        textUser: {
          fontSize: 16,
          color: colors.textOnPrimary,
          lineHeight: 24,
          flexShrink: 1,
          minWidth: 0,
          textAlign: 'right',
        },
        heartHintWrap: {
          position: 'absolute',
          right: 8,
          bottom: 8,
        },
        heartHint: { fontSize: 14, color: colors.textHint, fontWeight: '600' },
        heartHintActive: { color: colors.textSecondary },
        heartHintLiked: { color: '#ef4444' },
        timestamp: { fontSize: 11, color: colors.textHint, marginTop: 4, paddingHorizontal: 4 },
        timestampAi: { alignSelf: 'flex-start' },
        timestampUser: { alignSelf: 'flex-end' },
        systemChipWrap: { alignSelf: 'flex-start', marginBottom: 14, maxWidth: '92%' },
        systemChipText: {
          fontSize: 11,
          color: colors.primaryDarkLabel,
          backgroundColor: colors.greenPill,
          borderWidth: 1,
          borderColor: colors.primaryMuted,
          paddingVertical: 7,
          paddingHorizontal: 12,
          borderRadius: 999,
          overflow: 'hidden',
        },
        timestampSystem: {
          fontSize: 11,
          color: colors.textHint,
          marginTop: -8,
          paddingHorizontal: 4,
          alignSelf: 'flex-start',
        },
      }),
    [colors],
  );

  const isUser = message.role === 'user';
  const isSystemLog = message.role === 'system_log';
  const text = typeof message.text === 'string' ? softWrapText(message.text) : '';
  const canReact = message.role === 'assistant';

  const pressAnim = useRef(new Animated.Value(0)).current;
  const appearAnim = useRef(new Animated.Value(isUser ? 1 : 0)).current;
  const bubbleAnchorRef = useRef<View>(null);
  const [anchorRect, setAnchorRect] = useState<{ x: number; y: number; width: number; height: number } | null>(
    null,
  );

  useEffect(() => {
    Animated.spring(pressAnim, {
      toValue: reactionPickerOpen ? 1 : 0,
      useNativeDriver: true,
      damping: 18,
      stiffness: 220,
      mass: 0.9,
    }).start();
  }, [pressAnim, reactionPickerOpen]);

  useEffect(() => {
    if (isUser || isSystemLog) return;
    Animated.timing(appearAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [appearAnim, isSystemLog, isUser, message.id]);

  const bubbleAnimatedStyle = useMemo(
    () => ({
      opacity: appearAnim,
      transform: [
        {
          translateY: Animated.add(
            pressAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }),
            appearAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }),
          ),
        },
        { scale: pressAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] }) },
      ],
    }),
    [appearAnim, pressAnim],
  );

  const liftStyle = useMemo(() => {
    if (!reactionPickerOpen) return undefined;
    if (Platform.OS === 'ios') return styles.bubbleLiftIOS;
    if (Platform.OS === 'android') return styles.bubbleLiftAndroid;
    return undefined;
  }, [reactionPickerOpen, styles.bubbleLiftIOS, styles.bubbleLiftAndroid]);

  const heartSymbol = message.reaction === 'like' ? '❤️' : '♡';
  const heartStyle = useMemo(
    () => [
      styles.heartHint,
      reactionPickerOpen && styles.heartHintActive,
      message.reaction === 'like' && styles.heartHintLiked,
    ],
    [message.reaction, reactionPickerOpen, styles.heartHint, styles.heartHintActive, styles.heartHintLiked],
  );

  const measureAnchor = useCallback(() => {
    bubbleAnchorRef.current?.measureInWindow((x, y, width, height) => {
      if (!Number.isFinite(x) || !Number.isFinite(y) || !width || !height) return;
      setAnchorRect({ x, y, width, height });
    });
  }, []);

  useEffect(() => {
    if (!reactionPickerOpen) {
      setAnchorRect(null);
      return;
    }
    requestAnimationFrame(measureAnchor);
  }, [measureAnchor, reactionPickerOpen]);

  if (isSystemLog) {
    return (
      <View style={styles.row}>
        <View style={styles.systemChipWrap}>
          <Text style={styles.systemChipText}>✓ {text}</Text>
        </View>
        <Text style={styles.timestampSystem}>
          {message.timestamp.toLocaleString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.row, isUser && styles.rowUser]}>
      {text ? (
        <View style={[styles.messageWrap, isUser ? styles.messageWrapUser : styles.messageWrapAi]}>
          <Pressable
            onLongPress={() => {
              if (!canReact) return;
              onOpenReactionPicker(message.id);
              requestAnimationFrame(measureAnchor);
            }}
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
                anchorRect={anchorRect}
                onRequestClose={onCloseReactionPicker}
              />

              <View ref={bubbleAnchorRef} collapsable={false}>
                <Animated.View
                  style={[
                    styles.bubble,
                    isUser ? styles.bubbleUser : styles.bubbleAi,
                    !isUser && Platform.OS === 'ios' && styles.bubbleAiIos,
                    !isUser && Platform.OS === 'android' && styles.bubbleAiAndroid,
                    liftStyle,
                    bubbleAnimatedStyle,
                  ]}
                >
                  {isUser ? (
                    <Text style={styles.textUser}>{text}</Text>
                  ) : (
                    <ChatMarkdown text={text} isUser={false} />
                  )}

                  {canReact ? (
                    <View style={styles.heartHintWrap} pointerEvents="none">
                      <Text style={heartStyle}>
                        {heartSymbol}
                        {message.reactionPending ? '…' : ''}
                      </Text>
                    </View>
                  ) : null}
                </Animated.View>
              </View>
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
                onConfirm={onConfirmChatAction}
              />
            );
          case 'waist_confirm':
            return (
              <WaistConfirmCard
                key={`${message.id}-waist-${i}`}
                data={card.data}
                onConfirm={onConfirmChatAction}
              />
            );
          case 'body_fat_confirm':
            return (
              <BodyFatConfirmCard
                key={`${message.id}-bodyfat-${i}`}
                data={card.data}
                onConfirm={onConfirmChatAction}
              />
            );
          case 'goal_weight_confirm':
            return (
              <GoalWeightConfirmCard
                key={`${message.id}-goalw-${i}`}
                data={card.data}
                onConfirm={onConfirmChatAction}
              />
            );
          case 'height_confirm':
            return (
              <HeightConfirmCard
                key={`${message.id}-height-${i}`}
                data={card.data}
                onConfirm={onConfirmChatAction}
              />
            );
          case 'birth_date_confirm':
            return (
              <BirthDateConfirmCard
                key={`${message.id}-birth-${i}`}
                data={card.data}
                onConfirm={onConfirmChatAction}
              />
            );
          case 'intolerances_confirm':
            return (
              <IntolerancesConfirmCard
                key={`${message.id}-intol-${i}`}
                data={card.data}
                onConfirm={onConfirmChatAction}
              />
            );
          case 'pending_action_confirm': {
            const d = card.data;
            const highlight =
              typeof d.weight_kg === 'number' && Number.isFinite(d.weight_kg)
                ? d.weight_kg
                : typeof d.value === 'number' && Number.isFinite(d.value)
                  ? d.value
                  : undefined;
            const suffix =
              d.weight_kg != null || d.action_type === 'weight'
                ? 'kg'
                : d.action_type === 'body_fat'
                  ? '%'
                  : d.action_type === 'waist' && typeof d.unit === 'string'
                    ? d.unit
                    : undefined;
            return (
              <ConfirmActionCard
                key={`${message.id}-pconfirm-${i}`}
                data={d}
                onConfirm={onConfirmChatAction}
                highlightMetric={highlight}
                metricSuffix={suffix}
              />
            );
          }
          case 'recipe_alternative':
            return <RecipeAlternativeCard key={`${message.id}-recipe-${i}`} data={card.data} />;
          case 'nearby_restaurant_recommendation':
            return (
              <NearbyRestaurantRecommendationCard
                key={`${message.id}-nearby-${i}`}
                data={card.data}
              />
            );
          default:
            return null;
        }
      })}
    </View>
  );
}
