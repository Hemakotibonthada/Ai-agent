import { useState, useEffect } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  FormInput, Plus, Trash2, Copy, Eye, Save, Download, Upload,
  GripVertical, Settings, Type, Hash, Mail, Phone, ToggleLeft,
  Calendar, List, Image, FileText, AlignLeft, Check, Loader,
  ChevronDown, ChevronUp, Star, Code, Palette, Layers, Layout
} from 'lucide-react';
import { useIsDemoAccount } from '@/hooks/useDemoData';

interface FormField {
  id: string; type: string; label: string; placeholder: string;
  required: boolean; options?: string[]; validation?: string;
}

interface FormTemplate { id: string; name: string; category: string; fields: number; uses: number; }

const FIELD_TYPES = [
  { type: 'text', label: 'Text', icon: <Type className="w-4 h-4" /> },
  { type: 'number', label: 'Number', icon: <Hash className="w-4 h-4" /> },
  { type: 'email', label: 'Email', icon: <Mail className="w-4 h-4" /> },
  { type: 'phone', label: 'Phone', icon: <Phone className="w-4 h-4" /> },
  { type: 'textarea', label: 'Text Area', icon: <AlignLeft className="w-4 h-4" /> },
  { type: 'select', label: 'Dropdown', icon: <List className="w-4 h-4" /> },
  { type: 'checkbox', label: 'Checkbox', icon: <Check className="w-4 h-4" /> },
  { type: 'toggle', label: 'Toggle', icon: <ToggleLeft className="w-4 h-4" /> },
  { type: 'date', label: 'Date', icon: <Calendar className="w-4 h-4" /> },
  { type: 'file', label: 'File Upload', icon: <Image className="w-4 h-4" /> },
];

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

export default function FormBuilder() {
  const isDemo = useIsDemoAccount();
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'editor' | 'preview' | 'templates' | 'submissions'>('editor');
  const [fields, setFields] = useState<FormField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('Contact Us');
  const [formDescription, setFormDescription] = useState('We\'d love to hear from you. Fill out the form below and we\'ll get back to you shortly.');
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [submissions, setSubmissions] = useState<{ id: string; date: string; data: Record<string, string>; status: string }[]>([]);

  useEffect(() => {
    setTimeout(() => {
      setFields([
        { id: 'f1', type: 'text', label: 'Full Name', placeholder: 'Enter your name', required: true },
        { id: 'f2', type: 'email', label: 'Email Address', placeholder: 'you@example.com', required: true, validation: 'email' },
        { id: 'f3', type: 'phone', label: 'Phone Number', placeholder: '+1 (555) 000-0000', required: false },
        { id: 'f4', type: 'select', label: 'Subject', placeholder: 'Select a subject', required: true, options: ['General Inquiry', 'Support', 'Sales', 'Partnership'] },
        { id: 'f5', type: 'textarea', label: 'Message', placeholder: 'Tell us more...', required: true },
        { id: 'f6', type: 'toggle', label: 'Subscribe to newsletter', placeholder: '', required: false },
      ]);
      setTemplates([
        { id: 't1', name: 'Contact Form', category: 'General', fields: 6, uses: 1240 },
        { id: 't2', name: 'Job Application', category: 'HR', fields: 12, uses: 890 },
        { id: 't3', name: 'Bug Report', category: 'Support', fields: 8, uses: 2100 },
        { id: 't4', name: 'Event Registration', category: 'Events', fields: 10, uses: 650 },
        { id: 't5', name: 'Survey', category: 'Research', fields: 15, uses: 3400 },
        { id: 't6', name: 'Order Form', category: 'Commerce', fields: 9, uses: 1800 },
      ]);
      setSubmissions([
        { id: 's1', date: '2 min ago', data: { 'Full Name': 'Alice Johnson', 'Email': 'alice@example.com', 'Subject': 'Support' }, status: 'new' },
        { id: 's2', date: '15 min ago', data: { 'Full Name': 'Bob Smith', 'Email': 'bob@example.com', 'Subject': 'General' }, status: 'read' },
        { id: 's3', date: '1 hour ago', data: { 'Full Name': 'Carol White', 'Email': 'carol@example.com', 'Subject': 'Sales' }, status: 'replied' },
        { id: 's4', date: '3 hours ago', data: { 'Full Name': 'David Lee', 'Email': 'david@example.com', 'Subject': 'Partnership' }, status: 'read' },
      ]);
      setLoading(false);
    }, 400);
  }, []);

  const addField = (type: string) => {
    const ft = FIELD_TYPES.find(f => f.type === type);
    const newField: FormField = {
      id: `f${Date.now()}`, type, label: ft?.label || 'Field', placeholder: '', required: false,
      options: type === 'select' ? ['Option 1', 'Option 2', 'Option 3'] : undefined,
    };
    setFields(prev => [...prev, newField]);
    setSelectedFieldId(newField.id);
  };
  const removeField = (id: string) => { setFields(prev => prev.filter(f => f.id !== id)); if (selectedFieldId === id) setSelectedFieldId(null); };
  const duplicateField = (field: FormField) => { const copy = { ...field, id: `f${Date.now()}`, label: `${field.label} (copy)` }; setFields(prev => [...prev, copy]); };
  const selectedField = fields.find(f => f.id === selectedFieldId);

  const getFieldIcon = (type: string) => FIELD_TYPES.find(f => f.type === type)?.icon || <FormInput className="w-4 h-4" />;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
          <Loader className="w-8 h-8 text-cyan-500" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-cyan-950/20 to-gray-950 p-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="p-3 bg-cyan-500/20 rounded-xl">
              <Layout className="w-7 h-7 text-cyan-400" />
            </motion.div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Form Builder</h1>
              <p className="text-nexus-muted text-sm">Drag-and-drop form designer</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(['editor', 'preview', 'templates', 'submissions'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${view === v ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-nexus-muted hover:text-nexus-muted'}`}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {view === 'editor' && (
            <motion.div key="editor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-4">
              {/* Field Types Palette */}
              <div className="w-44 bg-gray-800/30 border border-gray-700/50 rounded-xl p-3 space-y-1.5 shrink-0">
                <h4 className="text-xs text-nexus-muted uppercase tracking-wider mb-2">Add Field</h4>
                {FIELD_TYPES.map(ft => (
                  <button key={ft.type} onClick={() => addField(ft.type)}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-nexus-muted text-xs rounded-lg hover:bg-nexus-surface/50 transition-colors">
                    <span className="text-cyan-400">{ft.icon}</span>
                    {ft.label}
                  </button>
                ))}
              </div>

              {/* Form Canvas */}
              <div className="flex-1 bg-gray-800/20 border border-gray-700/50 rounded-xl p-6">
                <input value={formTitle} onChange={e => setFormTitle(e.target.value)}
                  className="text-xl font-bold text-white bg-transparent border-none outline-none w-full mb-1" />
                <input value={formDescription} onChange={e => setFormDescription(e.target.value)}
                  className="text-sm text-nexus-muted bg-transparent border-none outline-none w-full mb-6" />

                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <motion.div key={field.id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                      onClick={() => setSelectedFieldId(field.id)}
                      className={`p-4 border rounded-xl cursor-pointer transition-all group ${selectedFieldId === field.id ? 'bg-gray-800/60 border-cyan-500/40' : 'bg-gray-800/30 border-gray-700/50 hover:border-nexus-border'}`}>
                      <div className="flex items-center gap-3">
                        <GripVertical className="w-4 h-4 text-nexus-muted cursor-grab" />
                        <span className="text-cyan-400">{getFieldIcon(field.type)}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-white font-medium">{field.label}</span>
                            {field.required && <span className="text-red-400 text-xs">*</span>}
                          </div>
                          {field.type === 'select' && field.options ? (
                            <select className="mt-2 w-full bg-nexus-surface/50 border border-nexus-border rounded-lg px-3 py-1.5 text-sm text-nexus-muted" disabled>
                              <option>{field.placeholder || 'Select...'}</option>
                              {field.options.map(o => <option key={o}>{o}</option>)}
                            </select>
                          ) : field.type === 'textarea' ? (
                            <textarea placeholder={field.placeholder} disabled rows={2} className="mt-2 w-full bg-nexus-surface/50 border border-nexus-border rounded-lg px-3 py-1.5 text-sm text-nexus-muted resize-none" />
                          ) : field.type === 'toggle' ? (
                            <div className="mt-2 w-10 h-5 bg-gray-600 rounded-full" />
                          ) : field.type === 'checkbox' ? (
                            <div className="mt-2 w-4 h-4 border border-nexus-border rounded" />
                          ) : (
                            <input type="text" placeholder={field.placeholder} disabled className="mt-2 w-full bg-nexus-surface/50 border border-nexus-border rounded-lg px-3 py-1.5 text-sm text-nexus-muted" />
                          )}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={e => { e.stopPropagation(); duplicateField(field); }} className="p-1 text-nexus-muted hover:text-blue-400"><Copy className="w-3.5 h-3.5" /></button>
                          <button onClick={e => { e.stopPropagation(); removeField(field.id); }} className="p-1 text-nexus-muted hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <button onClick={() => addField('text')} className="mt-4 w-full py-3 border-2 border-dashed border-gray-700/50 rounded-xl text-nexus-muted hover:text-cyan-400 hover:border-cyan-500/30 transition-colors text-sm flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> Add Field
                </button>
              </div>

              {/* Properties Panel */}
              {selectedField && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-56 bg-gray-800/30 border border-gray-700/50 rounded-xl p-4 shrink-0 space-y-3">
                  <h4 className="text-sm font-medium text-white flex items-center gap-1.5"><Settings className="w-4 h-4 text-cyan-400" /> Properties</h4>
                  <div><label className="text-xs text-nexus-muted block mb-1">Label</label>
                    <input value={selectedField.label} onChange={e => setFields(prev => prev.map(f => f.id === selectedField.id ? { ...f, label: e.target.value } : f))}
                      className="w-full bg-nexus-surface/50 border border-nexus-border rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500" />
                  </div>
                  <div><label className="text-xs text-nexus-muted block mb-1">Placeholder</label>
                    <input value={selectedField.placeholder} onChange={e => setFields(prev => prev.map(f => f.id === selectedField.id ? { ...f, placeholder: e.target.value } : f))}
                      className="w-full bg-nexus-surface/50 border border-nexus-border rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-nexus-muted">Required</span>
                    <button onClick={() => setFields(prev => prev.map(f => f.id === selectedField.id ? { ...f, required: !f.required } : f))}
                      className={`w-8 h-4 rounded-full transition-colors ${selectedField.required ? 'bg-cyan-600' : 'bg-gray-600'}`}>
                      <motion.div animate={{ x: selectedField.required ? 16 : 2 }} className="w-3 h-3 bg-nexus-card rounded-full" />
                    </button>
                  </div>
                  <div><label className="text-xs text-nexus-muted block mb-1">Type</label>
                    <span className="text-xs text-cyan-400 font-mono">{selectedField.type}</span>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {view === 'preview' && (
            <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-lg mx-auto">
              <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-8">
                <h2 className="text-xl font-bold text-white mb-1">{formTitle}</h2>
                <p className="text-sm text-nexus-muted mb-6">{formDescription}</p>
                <div className="space-y-5">
                  {fields.map(field => (
                    <div key={field.id}>
                      <label className="text-sm text-nexus-muted mb-1.5 block">{field.label} {field.required && <span className="text-red-400">*</span>}</label>
                      {field.type === 'textarea' ? (
                        <textarea placeholder={field.placeholder} rows={3} className="w-full bg-nexus-surface/50 border border-nexus-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none" />
                      ) : field.type === 'select' ? (
                        <select className="w-full bg-nexus-surface/50 border border-nexus-border rounded-lg px-3 py-2 text-sm text-nexus-muted focus:outline-none focus:border-cyan-500">
                          <option value="">{field.placeholder || 'Select...'}</option>
                          {field.options?.map(o => <option key={o}>{o}</option>)}
                        </select>
                      ) : field.type === 'toggle' ? (
                        <div className="w-10 h-5 bg-gray-600 rounded-full cursor-pointer"><div className="w-3 h-3 bg-nexus-card rounded-full translate-x-1 translate-y-1" /></div>
                      ) : field.type === 'checkbox' ? (
                        <label className="flex items-center gap-2 text-sm text-nexus-muted cursor-pointer"><input type="checkbox" className="accent-cyan-500" /> {field.placeholder || 'Yes'}</label>
                      ) : (
                        <input type={field.type} placeholder={field.placeholder} className="w-full bg-nexus-surface/50 border border-nexus-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500" />
                      )}
                    </div>
                  ))}
                  <button className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition-colors">Submit</button>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'templates' && (
            <motion.div key="templates" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map(tpl => (
                  <motion.div key={tpl.id} variants={itemVariants}
                    className="p-5 bg-gray-800/30 border border-gray-700/50 rounded-xl hover:border-cyan-500/40 transition-all cursor-pointer group">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-cyan-500/15 rounded-lg"><FileText className="w-5 h-5 text-cyan-400" /></div>
                      <div>
                        <h3 className="text-white font-medium text-sm">{tpl.name}</h3>
                        <span className="text-xs text-nexus-muted">{tpl.category}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-nexus-muted">
                      <span>{tpl.fields} fields</span>
                      <span>{tpl.uses.toLocaleString()} uses</span>
                    </div>
                    <button className="mt-3 w-full py-1.5 text-xs text-cyan-400 border border-cyan-500/20 rounded-lg hover:bg-cyan-500/10 opacity-0 group-hover:opacity-100 transition-all">
                      Use Template
                    </button>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}

          {view === 'submissions' && (
            <motion.div key="submissions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-gray-800/30 border border-gray-700/50 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-700/50 flex items-center justify-between">
                <h3 className="text-sm font-medium text-white">{submissions.length} Submissions</h3>
                <button className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Export</button>
              </div>
              <table className="w-full">
                <thead><tr className="text-xs text-nexus-muted uppercase tracking-wider border-b border-gray-700/30">
                  <th className="text-left p-3">Name</th><th className="text-left p-3">Email</th><th className="text-left p-3">Subject</th><th className="text-center p-3">Status</th><th className="text-right p-3">Time</th>
                </tr></thead>
                <tbody>
                  {submissions.map(sub => (
                    <motion.tr key={sub.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-gray-700/20 hover:bg-gray-800/40 text-sm">
                      <td className="p-3 text-white">{sub.data['Full Name']}</td>
                      <td className="p-3 text-nexus-muted">{sub.data['Email']}</td>
                      <td className="p-3 text-nexus-muted">{sub.data['Subject']}</td>
                      <td className="p-3 text-center">
                        <span className={`px-1.5 py-0.5 text-[10px] rounded ${sub.status === 'new' ? 'bg-blue-500/20 text-blue-400' : sub.status === 'read' ? 'bg-gray-500/20 text-nexus-muted' : 'bg-green-500/20 text-green-400'}`}>{sub.status}</span>
                      </td>
                      <td className="p-3 text-right text-xs text-nexus-muted">{sub.date}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
