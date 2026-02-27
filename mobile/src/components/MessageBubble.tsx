/* ===================================================================
   Nexus AI OS — MessageBubble Component
   Chat message bubble styled for user / AI messages
   =================================================================== */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { format, parseISO } from 'date-fns';
import { colors, typography, spacing, borderRadius } from '../lib/theme';
import type { Message } from '../lib/store';

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const timestamp = (() => {
    try {
      return format(parseISO(message.timestamp), 'HH:mm');
    } catch {
      return '';
    }
  })();

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAI]}>
      {/* AI avatar */}
      {!isUser && (
        <View style={styles.avatar}>
          <Icon name="sparkles" size={14} color={colors.primary} />
        </View>
      )}

      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
        {/* Agent indicator */}
        {!isUser && message.agent && (
          <Text style={styles.agentLabel}>{message.agent}</Text>
        )}

        <Text style={[styles.content, isUser ? styles.contentUser : styles.contentAI]}>
          {message.content}
        </Text>

        <Text style={[styles.time, isUser ? styles.timeUser : styles.timeAI]}>
          {timestamp}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    alignItems: 'flex-end',
  },
  rowUser: { justifyContent: 'flex-end' },
  rowAI: { justifyContent: 'flex-start' },

  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginBottom: 2,
  },

  bubble: {
    maxWidth: '78%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: borderRadius.sm,
  },
  bubbleAI: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },

  agentLabel: {
    ...typography.caption,
    color: colors.primary,
    marginBottom: spacing.xs,
    fontWeight: '700',
  },

  content: {
    ...typography.body,
    lineHeight: 21,
  },
  contentUser: { color: '#fff' },
  contentAI: { color: colors.text },

  time: {
    ...typography.caption,
    marginTop: spacing.xs,
    alignSelf: 'flex-end',
  },
  timeUser: { color: 'rgba(255,255,255,0.6)' },
  timeAI: { color: colors.muted },
});

export default MessageBubble;
