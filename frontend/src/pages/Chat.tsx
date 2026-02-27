/* ===================================================================
   Nexus AI OS — Chat Page
   Full AI conversation interface with sidebar & message actions
   =================================================================== */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Mic,
  Paperclip,
  Plus,
  Search,
  MoreVertical,
  Copy,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Bot,
  User,
  MessageSquare,
  Pin,
  Trash2,
  ChevronRight,
  Hash,
  Sparkles,
  X,
} from 'lucide-react';

import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import Skeleton from '@/components/ui/Skeleton';
import MarkdownRenderer from '@/components/shared/MarkdownRenderer';
import StatusIndicator from '@/components/shared/StatusIndicator';
import useStore from '@/lib/store';
import { chatApi } from '@/lib/api';
import type { Message, Conversation } from '@/types';

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */
const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const sidebar = {
  open: { width: 320, opacity: 1 },
  closed: { width: 0, opacity: 0 },
};

/* ------------------------------------------------------------------ */
/*  Typing Indicator                                                   */
/* ------------------------------------------------------------------ */
function TypingIndicator({ agent }: { agent?: string | null }) {
  return (
    <motion.div {...fadeUp} className="flex items-start gap-3 px-4 py-2">
      <Avatar fallback="AI" size="sm" glow />
      <div className="rounded-2xl rounded-tl-sm border border-nexus-border bg-nexus-card/80 backdrop-blur-sm px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          {agent && (
            <Badge variant="info" dot>
              {agent}
            </Badge>
          )}
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-2 w-2 rounded-full bg-nexus-primary"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Message Bubble                                                     */
/* ------------------------------------------------------------------ */
function MessageBubble({
  message,
  onCopy,
  onRegenerate,
}: {
  message: Message;
  onCopy: (text: string) => void;
  onRegenerate?: () => void;
}) {
  const isUser = message.role === 'user';
  const [showActions, setShowActions] = useState(false);
  const [liked, setLiked] = useState<null | 'up' | 'down'>(null);

  return (
    <motion.div
      {...fadeUp}
      transition={{ duration: 0.3 }}
      className={`group flex items-start gap-3 px-4 py-2 ${isUser ? 'flex-row-reverse' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar */}
      {isUser ? (
        <Avatar fallback="U" size="sm" status="online" />
      ) : (
        <Avatar fallback="AI" size="sm" glow />
      )}

      {/* Bubble */}
      <div
        className={`relative max-w-[75%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'rounded-tr-sm bg-nexus-primary/20 border border-nexus-primary/30 text-nexus-text'
            : 'rounded-tl-sm border border-nexus-border bg-nexus-card/80 backdrop-blur-sm text-nexus-text'
        }`}
      >
        {/* Agent badge */}
        {!isUser && message.agent && (
          <div className="mb-1.5">
            <Badge variant="info" dot>
              {message.agent}
            </Badge>
          </div>
        )}

        {/* Content */}
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        ) : (
          <MarkdownRenderer content={message.content} />
        )}

        {/* Timestamp */}
        <p className={`mt-1.5 text-[10px] ${isUser ? 'text-nexus-primary/60' : 'text-nexus-muted/60'} text-right`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>

        {/* Actions */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`absolute -bottom-8 ${isUser ? 'right-0' : 'left-0'} flex items-center gap-1 rounded-lg border border-nexus-border bg-nexus-surface/95 backdrop-blur-md px-1.5 py-1 shadow-lg z-10`}
            >
              <button
                onClick={() => onCopy(message.content)}
                className="p-1 rounded hover:bg-nexus-card/10 text-nexus-muted hover:text-nexus-text transition-colors"
                title="Copy"
              >
                <Copy size={12} />
              </button>
              {!isUser && onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="p-1 rounded hover:bg-nexus-card/10 text-nexus-muted hover:text-nexus-text transition-colors"
                  title="Regenerate"
                >
                  <RefreshCw size={12} />
                </button>
              )}
              {!isUser && (
                <>
                  <button
                    onClick={() => setLiked('up')}
                    className={`p-1 rounded hover:bg-nexus-card/10 transition-colors ${liked === 'up' ? 'text-emerald-400' : 'text-nexus-muted hover:text-nexus-text'}`}
                    title="Good response"
                  >
                    <ThumbsUp size={12} />
                  </button>
                  <button
                    onClick={() => setLiked('down')}
                    className={`p-1 rounded hover:bg-nexus-card/10 transition-colors ${liked === 'down' ? 'text-red-400' : 'text-nexus-muted hover:text-nexus-text'}`}
                    title="Bad response"
                  >
                    <ThumbsDown size={12} />
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Suggestion Chips                                                   */
/* ------------------------------------------------------------------ */
const suggestions = [
  'Summarize my tasks for today',
  "What's the weather at home?",
  'Check my email inbox',
  'Generate a weekly report',
  "How's my budget this month?",
  'Turn on the living room lights',
];

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function Chat() {
  const {
    messages,
    conversations,
    activeConversationId,
    isTyping,
    typingAgent,
    inputDraft,
    setMessages,
    setConversations,
    setActiveConversation,
    addMessage,
    setTyping,
    setInputDraft,
    clearChat,
    setCurrentPage,
  } = useStore();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentPage('/chat');
  }, [setCurrentPage]);

  /* Load conversations */
  useEffect(() => {
    chatApi.conversations()
      .then((data) => { if (Array.isArray(data)) setConversations(data); })
      .catch(() => {});
  }, [setConversations]);

  /* Load history when conversation changes */
  useEffect(() => {
    if (!activeConversationId) return;
    setLoading(true);
    chatApi
      .history(activeConversationId)
      .then((data) => { if (Array.isArray(data)) setMessages(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeConversationId, setMessages]);

  /* Auto-scroll */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  /* Send message */
  const handleSend = useCallback(async () => {
    const text = inputDraft.trim();
    if (!text) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      conversation_id: activeConversationId ?? 'new',
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    addMessage(userMsg);
    setInputDraft('');
    setTyping(true, 'Orchestrator');

    try {
      const res = await chatApi.send({
        message: text,
        conversation_id: activeConversationId ?? undefined,
      });
      if (res?.message) addMessage(res.message);
      if (!activeConversationId && res?.conversation_id) {
        setActiveConversation(res.conversation_id);
      }
    } catch {
      addMessage({
        id: crypto.randomUUID(),
        conversation_id: activeConversationId ?? 'new',
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: new Date().toISOString(),
        agent: 'System',
      });
    } finally {
      setTyping(false);
    }
  }, [inputDraft, activeConversationId, addMessage, setInputDraft, setTyping, setActiveConversation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex h-[calc(100vh-5rem)] overflow-hidden rounded-xl border border-nexus-border bg-nexus-card/40 backdrop-blur-md">
      {/* ── Sidebar ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial="closed"
            animate="open"
            exit="closed"
            variants={sidebar}
            transition={{ duration: 0.25 }}
            className="flex flex-col border-r border-nexus-border bg-nexus-surface/60 overflow-hidden"
          >
            {/* Sidebar Header */}
            <div className="flex items-center gap-2 p-3 border-b border-nexus-border/50">
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => {
                  clearChat();
                  setActiveConversation(null);
                }}
                className="flex-1"
              >
                New Chat
              </Button>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-lg hover:bg-nexus-card/10 text-nexus-muted transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Search */}
            <div className="px-3 py-2">
              <Input
                variant="search"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto scrollbar-thin px-2 space-y-0.5">
              {filteredConversations.length === 0 ? (
                <div className="text-center py-8 text-nexus-muted text-xs">
                  No conversations yet.<br />Start a new chat!
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <motion.button
                    key={conv.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveConversation(conv.id)}
                    className={`w-full text-left rounded-lg p-2.5 transition-colors ${
                      activeConversationId === conv.id
                        ? 'bg-nexus-primary/15 border border-nexus-primary/30'
                        : 'hover:bg-nexus-card/5 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare size={14} className="text-nexus-muted shrink-0" />
                      <span className="text-sm text-nexus-text truncate">{conv.title}</span>
                      {conv.pinned && <Pin size={10} className="text-nexus-primary shrink-0" />}
                    </div>
                    {conv.last_message && (
                      <p className="text-[11px] text-nexus-muted truncate mt-0.5 pl-5">
                        {conv.last_message}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1 pl-5">
                      <span className="text-[10px] text-nexus-muted/60">
                        {new Date(conv.updated_at).toLocaleDateString()}
                      </span>
                      {conv.agents_used.length > 0 && (
                        <Badge variant="neutral" className="text-[9px] py-0 px-1.5">
                          {conv.agents_used[0]}
                        </Badge>
                      )}
                    </div>
                  </motion.button>
                ))
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Main Chat Area ── */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Chat Header */}
        <div className="flex items-center gap-3 border-b border-nexus-border/50 px-4 py-3">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-lg hover:bg-nexus-card/10 text-nexus-muted transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          )}
          <Bot size={20} className="text-nexus-primary" />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-nexus-text">
              {activeConversationId
                ? conversations.find((c) => c.id === activeConversationId)?.title ?? 'Chat'
                : 'New Conversation'}
            </h2>
            <div className="flex items-center gap-2">
              <StatusIndicator status="active" size="sm" />
              <span className="text-[10px] text-nexus-muted">Nexus AI ready</span>
            </div>
          </div>
          <button className="p-1.5 rounded-lg hover:bg-nexus-card/10 text-nexus-muted transition-colors">
            <MoreVertical size={16} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-thin py-4 space-y-1">
          {loading ? (
            <div className="px-4 space-y-4">
              <Skeleton shape="rect" count={3} />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-nexus-primary/20 to-nexus-secondary/20 border border-nexus-border flex items-center justify-center mb-4">
                  <Sparkles size={32} className="text-nexus-primary" />
                </div>
              </motion.div>
              <h3 className="text-lg font-semibold text-nexus-text mb-2">Start a Conversation</h3>
              <p className="text-sm text-nexus-muted max-w-md">
                Ask me anything — I can help with tasks, home automation, financial insights,
                health tracking, and much more.
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onCopy={handleCopy}
                  onRegenerate={msg.role === 'assistant' ? () => {} : undefined}
                />
              ))}
            </AnimatePresence>
          )}

          {isTyping && <TypingIndicator agent={typingAgent} />}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        {messages.length === 0 && (
          <div className="px-4 pb-2">
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <motion.button
                  key={s}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    setInputDraft(s);
                    inputRef.current?.focus();
                  }}
                  className="rounded-full border border-nexus-border bg-nexus-card/60 px-3 py-1.5 text-xs text-nexus-muted hover:text-nexus-text hover:border-nexus-primary/40 transition-all"
                >
                  {s}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-nexus-border/50 p-3">
          <div className="flex items-center gap-2 rounded-xl border border-nexus-border bg-nexus-surface/60 px-3 py-2 focus-within:border-nexus-primary/50 transition-colors">
            <button className="p-1.5 rounded-lg hover:bg-nexus-card/10 text-nexus-muted transition-colors" title="Attach file">
              <Paperclip size={18} />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={inputDraft}
              onChange={(e) => setInputDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="flex-1 bg-transparent border-none text-sm text-nexus-text placeholder:text-nexus-muted/50 outline-none"
            />
            <button className="p-1.5 rounded-lg hover:bg-nexus-card/10 text-nexus-muted transition-colors" title="Voice input">
              <Mic size={18} />
            </button>
            <Button
              variant="primary"
              size="sm"
              icon={Send}
              onClick={handleSend}
              disabled={!inputDraft.trim() || isTyping}
              loading={isTyping}
            >
              Send
            </Button>
          </div>

          {/* Context display */}
          {activeConversationId && (
            <div className="flex items-center gap-2 mt-2 px-1">
              <Hash size={10} className="text-nexus-muted/60" />
              <span className="text-[10px] text-nexus-muted/60 truncate">
                Conversation: {activeConversationId.slice(0, 12)}...
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
