import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Plus, MessageSquare, Settings, ArrowRight, Play, Pause, Trash2,
  Copy, Download, Upload, Eye, Zap, GitBranch, Loader, Save,
  CornerDownRight, CircleDot, Square, Code, Type, Image, Hash,
  ToggleLeft, List, Calendar, ChevronRight, GripVertical, X
} from 'lucide-react';

interface FlowNode { id: string; type: string; label: string; x: number; y: number; config: Record<string, string>; connections: string[]; }
interface ChatBot { id: string; name: string; status: 'active' | 'draft' | 'paused'; messages: number; users: number; lastEdited: string; nodes: number; }

const NODE_TYPES = [
  { type: 'greeting', label: 'Greeting', icon: <MessageSquare className="w-4 h-4" />, color: '#8b5cf6' },
  { type: 'question', label: 'Question', icon: <Type className="w-4 h-4" />, color: '#3b82f6' },
  { type: 'condition', label: 'Condition', icon: <GitBranch className="w-4 h-4" />, color: '#f59e0b' },
  { type: 'action', label: 'Action', icon: <Zap className="w-4 h-4" />, color: '#10b981' },
  { type: 'api_call', label: 'API Call', icon: <Code className="w-4 h-4" />, color: '#06b6d4' },
  { type: 'response', label: 'Response', icon: <CornerDownRight className="w-4 h-4" />, color: '#ec4899' },
  { type: 'end', label: 'End', icon: <Square className="w-4 h-4" />, color: '#ef4444' },
];

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

export default function ChatbotBuilder() {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'bots' | 'builder' | 'preview'>('bots');
  const [bots, setBots] = useState<ChatBot[]>([]);
  const [selectedBot, setSelectedBot] = useState<ChatBot | null>(null);
  const [flowNodes, setFlowNodes] = useState<FlowNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [previewMessages, setPreviewMessages] = useState<{ role: 'bot' | 'user'; text: string }[]>([]);
  const [previewInput, setPreviewInput] = useState('');
  const [dragging, setDragging] = useState<string | null>(null);

  useEffect(() => {
    setTimeout(() => {
      setBots([
        { id: '1', name: 'Customer Support Bot', status: 'active', messages: 15420, users: 2340, lastEdited: '2 hours ago', nodes: 24 },
        { id: '2', name: 'Sales Assistant', status: 'active', messages: 8930, users: 1220, lastEdited: '5 hours ago', nodes: 18 },
        { id: '3', name: 'FAQ Bot', status: 'draft', messages: 0, users: 0, lastEdited: '1 day ago', nodes: 12 },
        { id: '4', name: 'Onboarding Guide', status: 'paused', messages: 3210, users: 890, lastEdited: '3 days ago', nodes: 31 },
        { id: '5', name: 'Feedback Collector', status: 'active', messages: 4560, users: 1100, lastEdited: '1 hour ago', nodes: 15 },
      ]);
      setFlowNodes([
        { id: 'n1', type: 'greeting', label: 'Welcome Message', x: 300, y: 50, config: { message: 'Hello! How can I help you?' }, connections: ['n2'] },
        { id: 'n2', type: 'question', label: 'Ask Intent', x: 300, y: 180, config: { prompt: 'What would you like help with?' }, connections: ['n3', 'n4'] },
        { id: 'n3', type: 'condition', label: 'Check Category', x: 150, y: 320, config: { condition: 'intent == "support"' }, connections: ['n5'] },
        { id: 'n4', type: 'action', label: 'Log Query', x: 450, y: 320, config: { action: 'log_to_db' }, connections: ['n6'] },
        { id: 'n5', type: 'api_call', label: 'Fetch Help', x: 150, y: 460, config: { url: '/api/help' }, connections: ['n7'] },
        { id: 'n6', type: 'response', label: 'Sales Pitch', x: 450, y: 460, config: { message: 'Let me connect you...' }, connections: ['n7'] },
        { id: 'n7', type: 'end', label: 'End Flow', x: 300, y: 600, config: {}, connections: [] },
      ]);
      setLoading(false);
    }, 400);
  }, []);

  const openBuilder = (bot: ChatBot) => { setSelectedBot(bot); setView('builder'); };
  const openPreview = () => {
    setPreviewMessages([{ role: 'bot', text: 'Hello! How can I help you today?' }]);
    setView('preview');
  };
  const sendPreviewMessage = () => {
    if (!previewInput.trim()) return;
    setPreviewMessages(prev => [...prev, { role: 'user', text: previewInput }]);
    const input = previewInput;
    setPreviewInput('');
    setTimeout(() => {
      setPreviewMessages(prev => [...prev, { role: 'bot', text: `I understand you're asking about "${input}". Let me look into that for you. Is there anything specific you need?` }]);
    }, 800);
  };

  const getNodeColor = (type: string) => NODE_TYPES.find(n => n.type === type)?.color || '#6b7280';
  const getNodeIcon = (type: string) => NODE_TYPES.find(n => n.type === type)?.icon || <CircleDot className="w-4 h-4" />;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
          <Loader className="w-8 h-8 text-purple-500" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950/20 to-gray-950 p-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="p-3 bg-purple-500/20 rounded-xl">
              <Bot className="w-7 h-7 text-purple-400" />
            </motion.div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Chatbot Builder</h1>
              <p className="text-nexus-muted text-sm">Visual flow designer for conversational AI</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {['bots', 'builder', 'preview'].map(v => (
              <button key={v} onClick={() => setView(v as typeof view)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${view === v ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-nexus-muted hover:text-nexus-muted'}`}>
                {v === 'bots' ? 'My Bots' : v === 'builder' ? 'Flow Builder' : 'Preview'}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {view === 'bots' && (
            <motion.div key="bots" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm text-nexus-muted">{bots.length} chatbots</h3>
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors">
                  <Plus className="w-3.5 h-3.5" /> New Chatbot
                </button>
              </div>
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bots.map(bot => (
                  <motion.div key={bot.id} variants={itemVariants} onClick={() => openBuilder(bot)}
                    className="p-5 bg-gray-800/30 border border-gray-700/50 rounded-xl cursor-pointer hover:border-purple-500/40 transition-all group">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-purple-500/15 rounded-lg"><Bot className="w-5 h-5 text-purple-400" /></div>
                        <div>
                          <h3 className="text-white font-medium text-sm">{bot.name}</h3>
                          <span className="text-xs text-nexus-muted">Edited {bot.lastEdited}</span>
                        </div>
                      </div>
                      <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${bot.status === 'active' ? 'bg-green-500/20 text-green-400' : bot.status === 'draft' ? 'bg-gray-500/20 text-nexus-muted' : 'bg-amber-500/20 text-amber-400'}`}>{bot.status}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div><span className="text-base font-bold text-white">{(bot.messages / 1000).toFixed(1)}k</span><span className="block text-[10px] text-nexus-muted">Messages</span></div>
                      <div><span className="text-base font-bold text-white">{(bot.users / 1000).toFixed(1)}k</span><span className="block text-[10px] text-nexus-muted">Users</span></div>
                      <div><span className="text-base font-bold text-white">{bot.nodes}</span><span className="block text-[10px] text-nexus-muted">Nodes</span></div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}

          {view === 'builder' && (
            <motion.div key="builder" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-4">
              {/* Node Palette */}
              <div className="w-48 bg-gray-800/30 border border-gray-700/50 rounded-xl p-3 space-y-2 shrink-0">
                <h4 className="text-xs text-nexus-muted uppercase tracking-wider mb-2">Nodes</h4>
                {NODE_TYPES.map(nt => (
                  <div key={nt.type} draggable onDragStart={() => setDragging(nt.type)} onDragEnd={() => setDragging(null)}
                    className="flex items-center gap-2 px-2.5 py-2 bg-gray-700/30 rounded-lg cursor-grab hover:bg-nexus-surface/50 transition-colors text-sm">
                    <GripVertical className="w-3 h-3 text-nexus-muted" />
                    <span style={{ color: nt.color }}>{nt.icon}</span>
                    <span className="text-nexus-muted text-xs">{nt.label}</span>
                  </div>
                ))}
                <hr className="border-gray-700/50" />
                <button onClick={openPreview} className="w-full flex items-center gap-1.5 px-2.5 py-2 bg-purple-600/30 text-purple-300 text-xs rounded-lg hover:bg-purple-600/40 transition-colors">
                  <Eye className="w-3.5 h-3.5" /> Preview Chat
                </button>
                <button className="w-full flex items-center gap-1.5 px-2.5 py-2 bg-green-600/30 text-green-300 text-xs rounded-lg hover:bg-green-600/40 transition-colors">
                  <Save className="w-3.5 h-3.5" /> Save Flow
                </button>
              </div>

              {/* Canvas */}
              <div className="flex-1 bg-gray-900/60 border border-gray-700/50 rounded-xl p-4 min-h-[600px] relative overflow-hidden">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, #374151 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
                  {flowNodes.map(node => node.connections.map(targetId => {
                    const target = flowNodes.find(n => n.id === targetId);
                    if (!target) return null;
                    return <line key={`${node.id}-${targetId}`} x1={node.x + 60} y1={node.y + 50} x2={target.x + 60} y2={target.y + 10} stroke="#6b7280" strokeWidth={2} strokeDasharray="5,5" />;
                  }))}
                </svg>
                {flowNodes.map(node => (
                  <motion.div key={node.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    onClick={() => setSelectedNode(node)}
                    style={{ position: 'absolute', left: node.x, top: node.y, zIndex: 2 }}
                    className={`w-[130px] p-3 bg-nexus-card border rounded-lg cursor-pointer transition-all ${selectedNode?.id === node.id ? 'border-purple-500 shadow-lg shadow-purple-500/20' : 'border-nexus-border hover:border-nexus-border'}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span style={{ color: getNodeColor(node.type) }}>{getNodeIcon(node.type)}</span>
                      <span className="text-[10px] uppercase tracking-wider text-nexus-muted">{node.type}</span>
                    </div>
                    <p className="text-xs text-white font-medium truncate">{node.label}</p>
                    {node.connections.length > 0 && (
                      <div className="mt-1.5 flex gap-1">
                        {node.connections.map(c => (<span key={c} className="text-[8px] bg-nexus-surface text-nexus-muted px-1 rounded">{c}</span>))}
                      </div>
                    )}
                  </motion.div>
                ))}

                {selectedNode && (
                  <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                    className="absolute right-4 top-4 w-56 bg-nexus-card border border-nexus-border rounded-xl p-4 z-10">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-white">{selectedNode.label}</h4>
                      <button onClick={() => setSelectedNode(null)} className="text-nexus-muted hover:text-nexus-muted"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="space-y-3 text-xs">
                      <div><span className="text-nexus-muted block mb-1">Type</span><span className="text-nexus-muted">{selectedNode.type}</span></div>
                      {Object.entries(selectedNode.config).map(([key, val]) => (
                        <div key={key}>
                          <span className="text-nexus-muted block mb-1">{key}</span>
                          <input value={val} readOnly className="w-full bg-nexus-surface/50 border border-nexus-border rounded px-2 py-1 text-nexus-muted text-xs focus:outline-none" />
                        </div>
                      ))}
                      <div className="flex gap-2 pt-2 border-t border-nexus-border">
                        <button className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-blue-600/30 text-blue-300 rounded hover:bg-blue-600/40"><Copy className="w-3 h-3" /> Clone</button>
                        <button className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-red-600/30 text-red-300 rounded hover:bg-red-600/40"><Trash2 className="w-3 h-3" /> Delete</button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'preview' && (
            <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-xl mx-auto">
              <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-gray-700/50 flex items-center gap-2">
                  <Bot className="w-5 h-5 text-purple-400" />
                  <span className="text-white text-sm font-medium">{selectedBot?.name || 'Chat Preview'}</span>
                  <span className="ml-auto px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded">Online</span>
                </div>
                <div className="h-96 overflow-y-auto p-4 space-y-3">
                  <AnimatePresence>
                    {previewMessages.map((msg, i) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${msg.role === 'user' ? 'bg-purple-600 text-white' : 'bg-nexus-surface text-gray-200'}`}>
                          {msg.text}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                <div className="p-3 border-t border-gray-700/50 flex gap-2">
                  <input value={previewInput} onChange={e => setPreviewInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendPreviewMessage()}
                    placeholder="Type a message..." className="flex-1 bg-nexus-surface/50 border border-nexus-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
                  <button onClick={sendPreviewMessage} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors flex items-center gap-1.5">
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
