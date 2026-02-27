import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Plus, Send, Search, Filter, Star, Pin,
  Archive, Trash2, Users, Hash, Lock, Bell, BellOff,
  Smile, Paperclip, Image, AtSign, ChevronDown, Settings,
  Circle, CheckCircle, Clock, Edit3, Reply, MoreHorizontal,
  Phone, Video, UserPlus, Info, ArrowLeft
} from 'lucide-react';

interface Message {
  id: string;
  userId: string;
  userName: string;
  avatar: string;
  content: string;
  timestamp: string;
  reactions: { emoji: string; count: number; reacted: boolean }[];
  attachments: { name: string; type: string; size: string }[];
  isPinned: boolean;
  isEdited: boolean;
  threadCount: number;
}

interface Channel {
  id: string;
  name: string;
  type: 'public' | 'private' | 'dm';
  description: string;
  members: number;
  unread: number;
  lastMessage: string;
  lastMessageTime: string;
  isMuted: boolean;
  isStarred: boolean;
}

interface TeamMember {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  role: string;
  statusMessage?: string;
}

const teamMembers: TeamMember[] = [
  { id: 'u1', name: 'Sarah Chen', avatar: 'SC', status: 'online', role: 'Lead Engineer', statusMessage: 'In a meeting until 3pm' },
  { id: 'u2', name: 'Alex Rivera', avatar: 'AR', status: 'online', role: 'Full Stack Dev' },
  { id: 'u3', name: 'Jordan Kim', avatar: 'JK', status: 'away', role: 'DevOps Engineer', statusMessage: 'AFK - back in 30min' },
  { id: 'u4', name: 'Maya Patel', avatar: 'MP', status: 'busy', role: 'UI/UX Designer', statusMessage: 'Deep focus mode' },
  { id: 'u5', name: 'David Lee', avatar: 'DL', status: 'online', role: 'Backend Engineer' },
  { id: 'u6', name: 'Emma Wilson', avatar: 'EW', status: 'offline', role: 'QA Engineer' },
  { id: 'u7', name: 'Chris Taylor', avatar: 'CT', status: 'online', role: 'Product Manager' },
  { id: 'u8', name: 'Priya Sharma', avatar: 'PS', status: 'away', role: 'Data Scientist' },
];

const channels: Channel[] = [
  { id: 'ch1', name: 'general', type: 'public', description: 'General discussion', members: 42, unread: 3, lastMessage: 'Great work on the release!', lastMessageTime: '2m ago', isMuted: false, isStarred: true },
  { id: 'ch2', name: 'engineering', type: 'public', description: 'Engineering updates and discussions', members: 28, unread: 12, lastMessage: 'PR #142 is ready for review', lastMessageTime: '5m ago', isMuted: false, isStarred: true },
  { id: 'ch3', name: 'design', type: 'public', description: 'Design system and UI/UX', members: 15, unread: 0, lastMessage: 'New mockups uploaded', lastMessageTime: '1h ago', isMuted: false, isStarred: false },
  { id: 'ch4', name: 'devops', type: 'public', description: 'Infrastructure and deployments', members: 12, unread: 1, lastMessage: 'k8s cluster scaled up', lastMessageTime: '15m ago', isMuted: false, isStarred: false },
  { id: 'ch5', name: 'security-alerts', type: 'private', description: 'Security incident reports', members: 8, unread: 0, lastMessage: 'Scan completed - all clear', lastMessageTime: '3h ago', isMuted: true, isStarred: false },
  { id: 'ch6', name: 'random', type: 'public', description: 'Off-topic fun', members: 42, unread: 25, lastMessage: '🎉 Happy Friday everyone!', lastMessageTime: '30m ago', isMuted: true, isStarred: false },
  { id: 'ch7', name: 'Sarah Chen', type: 'dm', description: '', members: 2, unread: 2, lastMessage: 'Can we sync on the API changes?', lastMessageTime: '10m ago', isMuted: false, isStarred: false },
  { id: 'ch8', name: 'Alex Rivera', type: 'dm', description: '', members: 2, unread: 0, lastMessage: 'Thanks for the code review!', lastMessageTime: '2h ago', isMuted: false, isStarred: false },
];

const sampleMessages: Message[] = [
  {
    id: 'm1', userId: 'u1', userName: 'Sarah Chen', avatar: 'SC',
    content: 'Hey team! 👋 The v2.1 release is looking great. All critical tests are passing and performance metrics are within target. Ready for the deploy meeting at 3pm.',
    timestamp: '2025-07-14T09:15:00Z', reactions: [{ emoji: '🎉', count: 5, reacted: true }, { emoji: '🚀', count: 3, reacted: false }],
    attachments: [], isPinned: true, isEdited: false, threadCount: 4,
  },
  {
    id: 'm2', userId: 'u5', userName: 'David Lee', avatar: 'DL',
    content: 'Just pushed the database migration scripts. The new indexing strategy should improve query performance by ~40%. Please review PR #142 when you get a chance.',
    timestamp: '2025-07-14T09:20:00Z', reactions: [{ emoji: '👀', count: 2, reacted: false }],
    attachments: [{ name: 'migration_v2.1.sql', type: 'file', size: '12.4 KB' }],
    isPinned: false, isEdited: true, threadCount: 0,
  },
  {
    id: 'm3', userId: 'u4', userName: 'Maya Patel', avatar: 'MP',
    content: 'Updated the design system components. The new dark mode palette is consistent across all pages now. Here are the mockups:',
    timestamp: '2025-07-14T09:35:00Z', reactions: [{ emoji: '❤️', count: 4, reacted: true }, { emoji: '✨', count: 2, reacted: false }],
    attachments: [{ name: 'dark-mode-v2.fig', type: 'design', size: '8.7 MB' }, { name: 'component-audit.pdf', type: 'document', size: '2.3 MB' }],
    isPinned: false, isEdited: false, threadCount: 7,
  },
  {
    id: 'm4', userId: 'u3', userName: 'Jordan Kim', avatar: 'JK',
    content: '⚠️ Heads up: We\'re scaling the k8s cluster today at 2pm UTC. There might be brief latency spikes during the transition. ETA for completion: 30 minutes.',
    timestamp: '2025-07-14T09:45:00Z', reactions: [{ emoji: '👍', count: 6, reacted: false }],
    attachments: [], isPinned: true, isEdited: false, threadCount: 2,
  },
  {
    id: 'm5', userId: 'u7', userName: 'Chris Taylor', avatar: 'CT',
    content: 'Sprint retrospective notes are up in Confluence. Key takeaway: we need better async communication practices. Let\'s discuss in tomorrow\'s standup.',
    timestamp: '2025-07-14T10:00:00Z', reactions: [],
    attachments: [{ name: 'retro-notes-sprint42.md', type: 'document', size: '4.1 KB' }],
    isPinned: false, isEdited: false, threadCount: 3,
  },
  {
    id: 'm6', userId: 'u2', userName: 'Alex Rivera', avatar: 'AR',
    content: 'Fixed the WebSocket reconnection bug 🐛. The client now properly handles connection drops with exponential backoff. Testing in staging right now.',
    timestamp: '2025-07-14T10:15:00Z', reactions: [{ emoji: '🎯', count: 3, reacted: true }],
    attachments: [], isPinned: false, isEdited: false, threadCount: 1,
  },
  {
    id: 'm7', userId: 'u8', userName: 'Priya Sharma', avatar: 'PS',
    content: 'The ML model retraining is complete. Accuracy improved from 92.3% to 95.1% on the validation set. Full report attached.',
    timestamp: '2025-07-14T10:30:00Z', reactions: [{ emoji: '🔥', count: 4, reacted: false }, { emoji: '🧠', count: 2, reacted: true }],
    attachments: [{ name: 'model-report-v3.pdf', type: 'document', size: '15.6 MB' }],
    isPinned: false, isEdited: false, threadCount: 5,
  },
];

const statusColors: Record<string, string> = {
  online: '#10b981', away: '#f59e0b', busy: '#ef4444', offline: '#6b7280',
};

export default function TeamChat() {
  const [activeChannel, setActiveChannel] = useState<Channel>(channels[1]);
  const [messageInput, setMessageInput] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [channelSection, setChannelSection] = useState<'channels' | 'dms'>('channels');

  const filteredChannels = channels.filter(ch => {
    if (channelSection === 'channels') return ch.type !== 'dm';
    return ch.type === 'dm';
  }).filter(ch => !searchQuery || ch.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white flex">
      {/* Sidebar */}
      <div className="w-72 border-r border-white/10 flex flex-col bg-black/20">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-lg font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            Team Chat
          </h2>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search channels..." className="w-full pl-9 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder:text-gray-500" />
          </div>
        </div>

        <div className="flex border-b border-white/10">
          {(['channels', 'dms'] as const).map(s => (
            <button key={s} onClick={() => setChannelSection(s)}
              className={`flex-1 py-2 text-xs font-medium transition-all ${channelSection === s ? 'text-white border-b-2 border-purple-500' : 'text-gray-500'}`}>
              {s === 'channels' ? 'Channels' : 'Direct Messages'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {filteredChannels.map(ch => (
            <button key={ch.id} onClick={() => setActiveChannel(ch)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                activeChannel.id === ch.id ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}>
              {ch.type === 'dm' ? (
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                  {ch.name.split(' ').map(w => w[0]).join('')}
                </div>
              ) : ch.type === 'private' ? (
                <Lock className="w-4 h-4 shrink-0 text-gray-500" />
              ) : (
                <Hash className="w-4 h-4 shrink-0 text-gray-500" />
              )}
              <div className="flex-1 min-w-0 text-left">
                <div className="truncate text-xs font-medium">{ch.name}</div>
              </div>
              {ch.unread > 0 && !ch.isMuted && (
                <span className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center text-[10px] font-bold">{ch.unread}</span>
              )}
              {ch.isStarred && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
            </button>
          ))}
        </div>

        {/* Online Members */}
        <div className="border-t border-white/10 p-3">
          <div className="text-xs text-gray-500 mb-2">Online — {teamMembers.filter(m => m.status === 'online').length}</div>
          <div className="space-y-1">
            {teamMembers.filter(m => m.status === 'online').slice(0, 4).map(m => (
              <div key={m.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 cursor-pointer">
                <div className="relative">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-[10px] font-bold">
                    {m.avatar}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-gray-900"
                    style={{ backgroundColor: statusColors[m.status] }} />
                </div>
                <span className="text-xs truncate">{m.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Channel Header */}
        <div className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-black/10">
          <div className="flex items-center gap-2">
            {activeChannel.type === 'dm' ? (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold">
                {activeChannel.name.split(' ').map(w => w[0]).join('')}
              </div>
            ) : (
              <Hash className="w-5 h-5 text-gray-400" />
            )}
            <div>
              <h3 className="font-semibold text-sm">{activeChannel.name}</h3>
              {activeChannel.description && <p className="text-xs text-gray-500">{activeChannel.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-white/5 rounded-lg"><Phone className="w-4 h-4 text-gray-400" /></button>
            <button className="p-2 hover:bg-white/5 rounded-lg"><Video className="w-4 h-4 text-gray-400" /></button>
            <button className="p-2 hover:bg-white/5 rounded-lg"><Pin className="w-4 h-4 text-gray-400" /></button>
            <button onClick={() => setShowMembers(!showMembers)} className={`p-2 rounded-lg ${showMembers ? 'bg-white/10' : 'hover:bg-white/5'}`}>
              <Users className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Messages */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {sampleMessages.map((msg, i) => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="group flex gap-3 hover:bg-white/[0.02] rounded-lg p-2 -mx-2">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    {msg.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-sm">{msg.userName}</span>
                      <span className="text-xs text-gray-500">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {msg.isEdited && <span className="text-xs text-gray-600">(edited)</span>}
                      {msg.isPinned && <Pin className="w-3 h-3 text-yellow-400" />}
                    </div>
                    <p className="text-sm text-gray-200 leading-relaxed">{msg.content}</p>

                    {msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {msg.attachments.map((att, j) => (
                          <div key={j} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10">
                            <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-xs font-medium">{att.name}</span>
                            <span className="text-xs text-gray-500">{att.size}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {msg.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {msg.reactions.map((r, j) => (
                          <button key={j} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all ${
                            r.reacted ? 'bg-purple-500/20 border border-purple-500/30' : 'bg-white/5 border border-white/10 hover:bg-white/10'
                          }`}>
                            <span>{r.emoji}</span>
                            <span className={r.reacted ? 'text-purple-300' : 'text-gray-400'}>{r.count}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {msg.threadCount > 0 && (
                      <button className="flex items-center gap-1 mt-2 text-xs text-purple-400 hover:text-purple-300">
                        <MessageSquare className="w-3 h-3" />
                        {msg.threadCount} replies
                      </button>
                    )}

                    {/* Hover actions */}
                    <div className="absolute right-2 top-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 bg-gray-800 border border-white/10 rounded-lg p-0.5">
                      <button className="p-1 hover:bg-white/10 rounded"><Smile className="w-3.5 h-3.5 text-gray-400" /></button>
                      <button className="p-1 hover:bg-white/10 rounded"><Reply className="w-3.5 h-3.5 text-gray-400" /></button>
                      <button className="p-1 hover:bg-white/10 rounded"><Pin className="w-3.5 h-3.5 text-gray-400" /></button>
                      <button className="p-1 hover:bg-white/10 rounded"><MoreHorizontal className="w-3.5 h-3.5 text-gray-400" /></button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-white/10">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <button className="p-1.5 hover:bg-white/10 rounded-lg"><Plus className="w-4 h-4 text-gray-400" /></button>
                  <button className="p-1.5 hover:bg-white/10 rounded-lg"><Image className="w-4 h-4 text-gray-400" /></button>
                  <button className="p-1.5 hover:bg-white/10 rounded-lg"><Paperclip className="w-4 h-4 text-gray-400" /></button>
                  <button className="p-1.5 hover:bg-white/10 rounded-lg"><AtSign className="w-4 h-4 text-gray-400" /></button>
                </div>
                <div className="flex items-end gap-2">
                  <textarea value={messageInput} onChange={e => setMessageInput(e.target.value)}
                    placeholder={`Message #${activeChannel.name}`}
                    className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-500 resize-none outline-none min-h-[20px] max-h-[120px]"
                    rows={1} />
                  <button className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg hover:opacity-90 transition-opacity shrink-0">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Members Panel */}
          <AnimatePresence>
            {showMembers && (
              <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 240, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                className="border-l border-white/10 overflow-hidden">
                <div className="w-60 p-4">
                  <h3 className="font-semibold text-sm mb-4">Members — {activeChannel.members}</h3>
                  <div className="space-y-1">
                    {teamMembers.map(m => (
                      <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer">
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-xs font-bold">
                            {m.avatar}
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-900"
                            style={{ backgroundColor: statusColors[m.status] }} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium truncate">{m.name}</div>
                          <div className="text-[10px] text-gray-500 truncate">{m.role}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
