import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Send, Paperclip, Bold, Italic, Underline, Link, Image, List,
  ListOrdered, AlignLeft, AlignCenter, AlignRight, Type, Palette,
  Search, Plus, Star, Trash2, Archive, Reply, ReplyAll, Forward,
  Clock, User, Tag, ChevronDown, ChevronRight, Inbox, Edit, Eye,
  Loader, MoreVertical, Check, X, AlertCircle, FileText, Download,
  Minimize2, Maximize2, AtSign, Hash, Smile
} from 'lucide-react';

interface EmailDraft { id: string; to: string; cc: string; bcc: string; subject: string; body: string; attachments: string[]; priority: string; scheduled: string; status: string; }
interface EmailTemplate { id: string; name: string; subject: string; body: string; category: string; }
interface Contact { name: string; email: string; avatar: string; recent: boolean; }

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.03 } } };
const itemVariants = { hidden: { opacity: 0, x: -8 }, visible: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } } };

export default function EmailComposer() {
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeDraft, setActiveDraft] = useState<EmailDraft | null>(null);
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [activeView, setActiveView] = useState<'compose' | 'drafts' | 'templates'>('compose');
  const [attachments, setAttachments] = useState<string[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDrafts([
        { id: 'd1', to: 'team@nexus-ai.com', cc: '', bcc: '', subject: 'Q1 2025 Sprint Planning', body: 'Hi team,\n\nPlease review the attached sprint planning document...', attachments: ['sprint_plan.pdf'], priority: 'high', scheduled: '', status: 'draft' },
        { id: 'd2', to: 'investor@venture.com', cc: 'ceo@nexus-ai.com', bcc: '', subject: 'Monthly Progress Report - January 2025', body: 'Dear Investor,\n\nI am pleased to share our progress...', attachments: ['report.pdf', 'metrics.xlsx'], priority: 'normal', scheduled: '2025-01-16T09:00:00Z', status: 'scheduled' },
        { id: 'd3', to: 'candidate@email.com', cc: 'hr@nexus-ai.com', bcc: '', subject: 'Interview Invitation - Senior AI Engineer', body: 'Dear Candidate,\n\nWe were impressed by your application...', attachments: [], priority: 'normal', scheduled: '', status: 'draft' },
      ]);
      setTemplates([
        { id: 't1', name: 'Welcome Email', subject: 'Welcome to NEXUS AI!', body: '<h2>Welcome aboard!</h2><p>We\'re thrilled to have you join the NEXUS AI team.</p>', category: 'onboarding' },
        { id: 't2', name: 'Sprint Update', subject: 'Sprint {{sprint_number}} Update', body: '<h3>Sprint Update</h3><p>Here\'s what we accomplished this sprint...</p>', category: 'engineering' },
        { id: 't3', name: 'Bug Report Follow-up', subject: 'Re: Bug Report #{{ticket_id}}', body: '<p>Thank you for reporting this issue. Our team has investigated...</p>', category: 'support' },
        { id: 't4', name: 'Meeting Invitation', subject: 'Meeting: {{topic}} - {{date}}', body: '<p>You are invited to a meeting regarding {{topic}}.</p><p>Date: {{date}}</p>', category: 'general' },
        { id: 't5', name: 'Release Notes', subject: 'NEXUS AI v{{version}} Release Notes', body: '<h2>Release Notes v{{version}}</h2><h3>New Features</h3><ul><li>Feature 1</li></ul>', category: 'engineering' },
      ]);
      setContacts([
        { name: 'Sarah Chen', email: 'sarah@nexus-ai.com', avatar: 'SC', recent: true },
        { name: 'Marcus Dev', email: 'marcus@nexus-ai.com', avatar: 'MD', recent: true },
        { name: 'Anna SQL', email: 'anna@nexus-ai.com', avatar: 'AS', recent: true },
        { name: 'Tech Lead', email: 'tech.lead@nexus-ai.com', avatar: 'TL', recent: false },
        { name: 'HR Team', email: 'hr@nexus-ai.com', avatar: 'HR', recent: false },
        { name: 'Support', email: 'support@nexus-ai.com', avatar: 'SP', recent: false },
      ]);
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleSend = useCallback(() => {
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setTo(''); setCc(''); setSubject(''); setBody(''); setAttachments([]);
    }, 1500);
  }, []);

  const loadDraft = (draft: EmailDraft) => {
    setActiveDraft(draft);
    setTo(draft.to); setCc(draft.cc); setSubject(draft.subject); setBody(draft.body);
    setAttachments(draft.attachments);
    setActiveView('compose');
  };

  const loadTemplate = (template: EmailTemplate) => {
    setSubject(template.subject); setBody(template.body);
    setShowTemplates(false);
    setActiveView('compose');
  };

  const toolbarButtons = [
    { icon: <Bold className="w-4 h-4" />, label: 'Bold' },
    { icon: <Italic className="w-4 h-4" />, label: 'Italic' },
    { icon: <Underline className="w-4 h-4" />, label: 'Underline' },
    null,
    { icon: <AlignLeft className="w-4 h-4" />, label: 'Left' },
    { icon: <AlignCenter className="w-4 h-4" />, label: 'Center' },
    { icon: <AlignRight className="w-4 h-4" />, label: 'Right' },
    null,
    { icon: <List className="w-4 h-4" />, label: 'Bullet List' },
    { icon: <ListOrdered className="w-4 h-4" />, label: 'Numbered List' },
    null,
    { icon: <Link className="w-4 h-4" />, label: 'Link' },
    { icon: <Image className="w-4 h-4" />, label: 'Image' },
    { icon: <Type className="w-4 h-4" />, label: 'Heading' },
    { icon: <Smile className="w-4 h-4" />, label: 'Emoji' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
          <Loader className="w-8 h-8 text-blue-500" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-blue-950/20 to-gray-950 p-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div whileHover={{ scale: 1.1, y: -2 }} className="p-3 bg-blue-500/20 rounded-xl"><Mail className="w-7 h-7 text-blue-400" /></motion.div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Email Composer</h1>
              <p className="text-gray-400 text-sm">Rich text email drafting & template management</p>
            </div>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex gap-1 bg-gray-800/30 rounded-xl p-1 border border-gray-700/50">
          {[
            { key: 'compose' as const, label: 'Compose', icon: <Edit className="w-4 h-4" /> },
            { key: 'drafts' as const, label: 'Drafts', icon: <FileText className="w-4 h-4" />, count: drafts.length },
            { key: 'templates' as const, label: 'Templates', icon: <Palette className="w-4 h-4" />, count: templates.length },
          ].map(tab => (
            <motion.button key={tab.key} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setActiveView(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeView === tab.key ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'}`}>
              {tab.icon}<span>{tab.label}</span>
              {'count' in tab && <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeView === tab.key ? 'bg-blue-500/50' : 'bg-gray-700/50'}`}>{tab.count}</span>}
            </motion.button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Compose View */}
          {activeView === 'compose' && (
            <motion.div key="compose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-gray-800/30 border border-gray-700/50 rounded-xl overflow-hidden">
              {/* To/CC/Subject fields */}
              <div className="border-b border-gray-700/50">
                <div className="flex items-center border-b border-gray-700/30 px-4">
                  <span className="text-sm text-gray-500 w-16">To:</span>
                  <input type="text" value={to} onChange={e => setTo(e.target.value)} placeholder="recipient@example.com" className="flex-1 py-3 bg-transparent text-sm text-gray-200 placeholder-gray-600 focus:outline-none" />
                  <motion.button whileHover={{ scale: 1.1 }} onClick={() => setShowContacts(!showContacts)} className="p-1.5 hover:bg-gray-700/50 rounded"><AtSign className="w-4 h-4 text-gray-400" /></motion.button>
                </div>
                <div className="flex items-center border-b border-gray-700/30 px-4">
                  <span className="text-sm text-gray-500 w-16">CC:</span>
                  <input type="text" value={cc} onChange={e => setCc(e.target.value)} placeholder="cc@example.com" className="flex-1 py-3 bg-transparent text-sm text-gray-200 placeholder-gray-600 focus:outline-none" />
                </div>
                <div className="flex items-center px-4">
                  <span className="text-sm text-gray-500 w-16">Subject:</span>
                  <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject..." className="flex-1 py-3 bg-transparent text-sm text-gray-200 placeholder-gray-600 focus:outline-none font-medium" />
                </div>
              </div>

              {/* Contacts Dropdown */}
              <AnimatePresence>
                {showContacts && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-b border-gray-700/50 bg-gray-900/50 overflow-hidden">
                    <div className="p-3 grid grid-cols-3 gap-2">
                      {contacts.map(c => (
                        <motion.button key={c.email} whileHover={{ scale: 1.02 }} onClick={() => { setTo(prev => prev ? `${prev}, ${c.email}` : c.email); setShowContacts(false); }}
                          className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-800/50 transition-colors text-left">
                          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-medium text-blue-400">{c.avatar}</div>
                          <div className="min-w-0">
                            <p className="text-sm text-white truncate">{c.name}</p>
                            <p className="text-xs text-gray-500 truncate">{c.email}</p>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Toolbar */}
              <div className="flex items-center gap-0.5 px-3 py-2 border-b border-gray-700/50 bg-gray-800/20">
                {toolbarButtons.map((btn, i) => btn ? (
                  <motion.button key={i} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-2 rounded hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-colors" title={btn.label}>{btn.icon}</motion.button>
                ) : (
                  <div key={i} className="w-px h-5 bg-gray-700 mx-1" />
                ))}
              </div>

              {/* Body */}
              <textarea value={body} onChange={e => setBody(e.target.value)}
                placeholder="Write your email here..."
                className="w-full min-h-[300px] p-4 bg-transparent text-gray-200 placeholder-gray-600 focus:outline-none resize-none text-sm leading-relaxed" />

              {/* Attachments */}
              {attachments.length > 0 && (
                <div className="px-4 py-2 border-t border-gray-700/50 flex items-center gap-2 flex-wrap">
                  {attachments.map((file, i) => (
                    <span key={i} className="flex items-center gap-1.5 px-2 py-1 bg-gray-700/50 rounded text-xs text-gray-300">
                      <Paperclip className="w-3 h-3" /> {file}
                      <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-red-400"><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between p-3 border-t border-gray-700/50 bg-gray-800/20">
                <div className="flex items-center gap-2">
                  <motion.button whileHover={{ scale: 1.05 }} className="p-2 hover:bg-gray-700/50 rounded-lg"><Paperclip className="w-4 h-4 text-gray-400" /></motion.button>
                  <motion.button whileHover={{ scale: 1.05 }} className="p-2 hover:bg-gray-700/50 rounded-lg"><Clock className="w-4 h-4 text-gray-400" /></motion.button>
                  <motion.button whileHover={{ scale: 1.05 }} onClick={() => setShowPreview(!showPreview)} className={`p-2 rounded-lg ${showPreview ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-gray-700/50 text-gray-400'}`}><Eye className="w-4 h-4" /></motion.button>
                </div>
                <div className="flex items-center gap-2">
                  <motion.button whileHover={{ scale: 1.05 }} className="px-4 py-2 bg-gray-700/50 text-gray-300 rounded-lg text-sm hover:bg-gray-600/50 transition-colors">Save Draft</motion.button>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleSend} disabled={sending || !to || !subject}
                    className={`px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${!to || !subject ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25'}`}>
                    {sending ? <><Loader className="w-4 h-4 animate-spin" /> Sending...</> : <><Send className="w-4 h-4" /> Send</>}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Drafts View */}
          {activeView === 'drafts' && (
            <motion.div key="drafts" variants={containerVariants} initial="hidden" animate="visible" exit="hidden" className="space-y-2">
              {drafts.map(draft => (
                <motion.div key={draft.id} variants={itemVariants} onClick={() => loadDraft(draft)}
                  className="p-4 bg-gray-800/30 border border-gray-700/50 rounded-xl cursor-pointer hover:border-gray-600 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-white text-sm">{draft.subject || '(No subject)'}</span>
                        {draft.priority === 'high' && <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">high priority</span>}
                        {draft.status === 'scheduled' && <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded flex items-center gap-1"><Clock className="w-3 h-3" /> scheduled</span>}
                      </div>
                      <p className="text-xs text-gray-500">To: {draft.to}</p>
                      <p className="text-xs text-gray-600 mt-1 truncate">{draft.body}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {draft.attachments.length > 0 && <span className="text-xs text-gray-500 flex items-center gap-1"><Paperclip className="w-3 h-3" /> {draft.attachments.length}</span>}
                      <motion.button whileHover={{ scale: 1.1 }} onClick={e => { e.stopPropagation(); }} className="p-1.5 hover:bg-red-500/20 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-gray-400" /></motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Templates View */}
          {activeView === 'templates' && (
            <motion.div key="templates" variants={containerVariants} initial="hidden" animate="visible" exit="hidden" className="grid grid-cols-2 gap-4">
              {templates.map(template => (
                <motion.div key={template.id} variants={itemVariants} onClick={() => loadTemplate(template)}
                  className="p-5 bg-gray-800/30 border border-gray-700/50 rounded-xl cursor-pointer hover:border-blue-500/50 transition-all group">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-white text-sm">{template.name}</h3>
                    <span className="px-1.5 py-0.5 bg-gray-700/50 text-gray-400 text-xs rounded">{template.category}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">Subject: <span className="text-gray-400">{template.subject}</span></p>
                  <div className="text-xs text-gray-600 line-clamp-2" dangerouslySetInnerHTML={{ __html: template.body }} />
                  <p className="text-xs text-blue-400 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">Click to use this template →</p>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
