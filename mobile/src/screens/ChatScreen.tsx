/* ===================================================================
   Nexus AI OS — Mobile Chat Screen
   Conversation list / chat toggle, message bubbles, voice & text input
   =================================================================== */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

import Header from '../components/Header';
import MessageBubble from '../components/MessageBubble';
import Card from '../components/Card';
import { colors, typography, spacing, borderRadius } from '../lib/theme';
import { chatApi } from '../lib/api';
import { useStore } from '../lib/store';
import type { Message, Conversation } from '../lib/store';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
const ChatScreen: React.FC = () => {
  const {
    messages, conversations, activeConversationId,
    isTyping, typingAgent, inputDraft,
    addMessage, setMessages, setConversations,
    setActiveConversation, setTyping, setInputDraft, clearChat,
  } = useStore();

  const [showConversations, setShowConversations] = useState(!activeConversationId);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingAnim = useRef(new Animated.Value(0)).current;

  /* ---- Load conversations ---- */
  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const convos = await chatApi.conversations();
      setConversations(convos);
    } catch {}
  };

  /* ---- Typing animation ---- */
  useEffect(() => {
    if (isTyping) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(typingAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(typingAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      typingAnim.setValue(0);
    }
  }, [isTyping]);

  /* ---- Select conversation ---- */
  const selectConversation = async (convo: Conversation) => {
    setActiveConversation(convo.id);
    setShowConversations(false);
    setLoading(true);
    try {
      const history = await chatApi.history(convo.id);
      setMessages(history);
    } catch {}
    setLoading(false);
  };

  /* ---- Start new chat ---- */
  const startNewChat = () => {
    clearChat();
    setShowConversations(false);
  };

  /* ---- Send message ---- */
  const sendMessage = async () => {
    const text = inputDraft.trim();
    if (!text) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      conversation_id: activeConversationId ?? 'new',
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    addMessage(userMsg);
    setInputDraft('');
    setTyping(true, 'Nexus AI');

    try {
      const response = await chatApi.send({
        message: text,
        conversation_id: activeConversationId ?? undefined,
      });

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        conversation_id: response.conversation_id ?? activeConversationId ?? 'new',
        role: 'assistant',
        content: response.response ?? response.message ?? 'I processed your request.',
        timestamp: new Date().toISOString(),
        agent: response.agent,
      };

      if (!activeConversationId && response.conversation_id) {
        setActiveConversation(response.conversation_id);
      }

      addMessage(aiMsg);
    } catch {
      addMessage({
        id: (Date.now() + 1).toString(),
        conversation_id: activeConversationId ?? 'new',
        role: 'assistant',
        content: 'Sorry, I couldn\'t process that. Please check your connection.',
        timestamp: new Date().toISOString(),
      });
    }

    setTyping(false);
  };

  /* ---- Pull to load older ---- */
  const loadOlderMessages = async () => {
    if (!activeConversationId || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const older = await chatApi.history(activeConversationId, 50, messages.length);
      if (older.length > 0) {
        setMessages([...older, ...messages]);
      }
    } catch {}
    setLoadingOlder(false);
  };

  /* ---- Voice input stub ---- */
  const handleVoiceInput = () => {
    // Voice recording integration placeholder
  };

  /* ---------------------------------------------------------------- */
  /*  Conversation list view                                           */
  /* ---------------------------------------------------------------- */
  if (showConversations) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header
          title="Conversations"
          rightIcon="add-circle-outline"
          onRightPress={startNewChat}
        />
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Icon name="chatbubbles-outline" size={48} color={colors.muted} />
              <Text style={styles.emptyText}>No conversations yet</Text>
              <TouchableOpacity style={styles.newChatBtn} onPress={startNewChat}>
                <Text style={styles.newChatBtnText}>Start a Chat</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => selectConversation(item)}>
              <Card style={styles.convoCard}>
                <View style={styles.convoIcon}>
                  <Icon name="chatbubble" size={20} color={colors.primary} />
                </View>
                <View style={styles.convoContent}>
                  <Text style={styles.convoTitle} numberOfLines={1}>
                    {item.title || 'Untitled'}
                  </Text>
                  <Text style={styles.convoPreview} numberOfLines={1}>
                    {item.last_message || 'No messages'}
                  </Text>
                </View>
                <View style={styles.convoMeta}>
                  <Text style={styles.convoCount}>{item.message_count}</Text>
                  <Icon name="chevron-forward" size={16} color={colors.muted} />
                </View>
              </Card>
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Chat view                                                        */
  /* ---------------------------------------------------------------- */
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title={typingAgent ? `${typingAgent} is typing…` : 'Chat'}
        leftIcon="arrow-back"
        onLeftPress={() => {
          setShowConversations(true);
          loadConversations();
        }}
      />

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          inverted={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onStartReached={loadOlderMessages}
          onStartReachedThreshold={0.1}
          ListHeaderComponent={
            loadingOlder ? (
              <ActivityIndicator color={colors.primary} style={{ padding: spacing.md }} />
            ) : null
          }
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 100 }} />
            ) : (
              <View style={styles.emptyChatWrap}>
                <Icon name="sparkles" size={48} color={colors.primary} />
                <Text style={styles.emptyChatTitle}>Nexus AI</Text>
                <Text style={styles.emptyChatSub}>
                  Ask me anything — I can help with tasks,{'\n'}home control, health, and more.
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => <MessageBubble message={item} />}
        />

        {/* Typing indicator */}
        {isTyping && (
          <Animated.View style={[styles.typingRow, { opacity: typingAnim }]}>
            <View style={styles.typingDot} />
            <View style={[styles.typingDot, { marginLeft: 4 }]} />
            <View style={[styles.typingDot, { marginLeft: 4 }]} />
            <Text style={styles.typingText}>
              {typingAgent ?? 'AI'} is thinking...
            </Text>
          </Animated.View>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.voiceBtn} onPress={handleVoiceInput}>
            <Icon name="mic" size={22} color={colors.primary} />
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            placeholder="Message Nexus AI..."
            placeholderTextColor={colors.placeholder}
            value={inputDraft}
            onChangeText={setInputDraft}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
            multiline
            maxLength={4000}
          />

          <TouchableOpacity
            style={[
              styles.sendBtn,
              { backgroundColor: inputDraft.trim() ? colors.primary : colors.border },
            ]}
            onPress={sendMessage}
            disabled={!inputDraft.trim()}
          >
            <Icon name="send" size={18} color={inputDraft.trim() ? '#fff' : colors.muted} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: spacing.lg, gap: spacing.sm },
  chatContainer: { flex: 1 },
  messagesContent: { padding: spacing.lg, paddingBottom: spacing.sm },

  /* Empty states */
  emptyWrap: { alignItems: 'center', marginTop: 80, gap: spacing.md },
  emptyText: { ...typography.body, color: colors.muted },
  newChatBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: spacing.md,
  },
  newChatBtnText: { ...typography.button, color: '#fff' },

  emptyChatWrap: { alignItems: 'center', marginTop: 80, gap: spacing.sm },
  emptyChatTitle: { ...typography.h1, color: colors.text },
  emptyChatSub: { ...typography.body, color: colors.muted, textAlign: 'center' },

  /* Conversation cards */
  convoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
  convoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  convoContent: { flex: 1, marginLeft: spacing.md },
  convoTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
  convoPreview: { ...typography.bodySmall, color: colors.muted, marginTop: 2 },
  convoMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  convoCount: { ...typography.caption, color: colors.muted },

  /* Typing */
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  typingText: { ...typography.caption, color: colors.muted, marginLeft: spacing.sm },

  /* Input bar */
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  voiceBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ChatScreen;
