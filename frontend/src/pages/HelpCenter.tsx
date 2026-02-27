import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HelpCircle, Book, MessageSquare, Video, FileText, Search,
  ChevronRight, ChevronDown, ExternalLink, Star, ThumbsUp,
  ThumbsDown, BookOpen, Zap, Shield, Settings, Home, Brain,
  Code, Terminal, Database, Globe, Heart, Users, Lightbulb,
  ArrowRight, X, Play, Clock
} from 'lucide-react';
import { FadeIn } from '../lib/animations';

interface Article {
  id: string;
  title: string;
  category: string;
  summary: string;
  content: string;
  views: number;
  helpful: number;
  readTime: string;
  tags: string[];
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
}

const categories = [
  { id: 'getting-started', label: 'Getting Started', icon: <Zap size={16} />, color: 'bg-blue-500', count: 12 },
  { id: 'agents', label: 'AI Agents', icon: <Brain size={16} />, color: 'bg-purple-500', count: 18 },
  { id: 'automations', label: 'Automations', icon: <Settings size={16} />, color: 'bg-green-500', count: 15 },
  { id: 'smart-home', label: 'Smart Home', icon: <Home size={16} />, color: 'bg-orange-500', count: 10 },
  { id: 'security', label: 'Security', icon: <Shield size={16} />, color: 'bg-red-500', count: 8 },
  { id: 'api', label: 'API & Integrations', icon: <Code size={16} />, color: 'bg-cyan-500', count: 22 },
  { id: 'troubleshooting', label: 'Troubleshooting', icon: <HelpCircle size={16} />, color: 'bg-yellow-500', count: 14 },
  { id: 'advanced', label: 'Advanced Topics', icon: <Terminal size={16} />, color: 'bg-indigo-500', count: 9 },
];

const articles: Article[] = [
  { id: '1', title: 'Quick Start Guide: Setting Up NexusAI', category: 'getting-started',
    summary: 'Get started with NexusAI in under 10 minutes. Learn how to configure your first agents and automations.',
    content: 'Follow these steps to get started...', views: 2456, helpful: 234, readTime: '5 min', tags: ['beginner', 'setup'] },
  { id: '2', title: 'Understanding AI Agent Architecture', category: 'agents',
    summary: 'Deep dive into how NexusAI agents work, including the orchestrator pattern and inter-agent communication.',
    content: 'NexusAI uses a multi-agent architecture...', views: 1823, helpful: 189, readTime: '12 min', tags: ['architecture', 'advanced'] },
  { id: '3', title: 'Creating Custom Automations', category: 'automations',
    summary: 'Learn to build powerful automations with triggers, conditions, and actions to control your smart environment.',
    content: 'Automations consist of three parts...', views: 3102, helpful: 312, readTime: '8 min', tags: ['automation', 'workflow'] },
  { id: '4', title: 'Configuring Smart Home Devices', category: 'smart-home',
    summary: 'Connect and manage your IoT devices through MQTT, including ESP32 sensor nodes and smart switches.',
    content: 'Before connecting devices...', views: 1567, helpful: 145, readTime: '10 min', tags: ['iot', 'mqtt', 'esp32'] },
  { id: '5', title: 'Security Best Practices', category: 'security',
    summary: 'Protect your NexusAI instance with these security configurations including 2FA, API keys, and network policies.',
    content: 'Security is paramount...', views: 987, helpful: 98, readTime: '7 min', tags: ['security', 'authentication'] },
  { id: '6', title: 'REST API Reference', category: 'api',
    summary: 'Complete reference for the NexusAI REST API including authentication, endpoints, and response formats.',
    content: 'The API supports JSON...', views: 4521, helpful: 401, readTime: '15 min', tags: ['api', 'rest', 'reference'] },
  { id: '7', title: 'Troubleshooting Connection Issues', category: 'troubleshooting',
    summary: 'Common solutions for WebSocket disconnects, MQTT failures, and API timeout errors.',
    content: 'If you experience disconnects...', views: 2134, helpful: 201, readTime: '6 min', tags: ['debug', 'network'] },
  { id: '8', title: 'Building Custom Plugins', category: 'advanced',
    summary: 'Create your own plugins to extend NexusAI functionality. Includes the plugin API and marketplace submission guide.',
    content: 'Plugins extend NexusAI...', views: 876, helpful: 87, readTime: '20 min', tags: ['plugin', 'development'] },
  { id: '9', title: 'Voice Command Configuration', category: 'agents',
    summary: 'Set up and customize voice commands, wake words, and natural language processing for hands-free control.',
    content: 'Voice commands use...', views: 1345, helpful: 134, readTime: '8 min', tags: ['voice', 'nlp'] },
  { id: '10', title: 'Data Pipeline Best Practices', category: 'advanced',
    summary: 'Design efficient ETL pipelines for data processing, including scheduling, error handling, and monitoring.',
    content: 'Data pipelines should...', views: 756, helpful: 76, readTime: '14 min', tags: ['pipeline', 'etl'] },
];

const faqs: FAQ[] = [
  { id: '1', question: 'How do I reset my NexusAI password?', answer: 'Go to Settings > Security > Password and click "Change Password". You\'ll need your current password to set a new one. If you forgot your password, use the recovery email option on the login page.', category: 'getting-started' },
  { id: '2', question: 'Can I run NexusAI without internet?', answer: 'Yes! NexusAI is designed to work locally. Core features like agent interactions, automations, and smart home control work entirely offline. Some features like news feeds and weather require internet.', category: 'getting-started' },
  { id: '3', question: 'How many agents can run simultaneously?', answer: 'NexusAI supports up to 15 concurrent agents. The orchestrator manages resource allocation and priority scheduling to ensure optimal performance even under heavy load.', category: 'agents' },
  { id: '4', question: 'What IoT protocols are supported?', answer: 'NexusAI supports MQTT, HTTP/REST, WebSocket, and Zigbee (via bridge). ESP32-based devices connect natively via MQTT. Z-Wave support is planned for a future release.', category: 'smart-home' },
  { id: '5', question: 'How do I enable two-factor authentication?', answer: 'Navigate to Settings > Security > Two-Factor Authentication. Click "Enable 2FA", scan the QR code with your authenticator app, and enter the verification code to complete setup.', category: 'security' },
  { id: '6', question: 'What is the API rate limit?', answer: 'The default rate limit is 100 requests per minute per API key. Premium users get 1000 requests/minute. Rate limit headers are included in every response.', category: 'api' },
  { id: '7', question: 'How do I backup my data?', answer: 'Go to Settings > System > Backup. You can configure automatic daily backups or trigger manual backups. Backups include database, configurations, and learned preferences.', category: 'troubleshooting' },
  { id: '8', question: 'Can I use custom AI models?', answer: 'Yes! NexusAI supports custom model integration. Place your GGUF models in the data/models directory and configure them in Settings > AI Models. ONNX and TensorFlow formats are also supported.', category: 'advanced' },
];

const tutorials = [
  { id: '1', title: 'Getting Started with NexusAI', duration: '12:30', thumbnail: '🚀', level: 'Beginner' },
  { id: '2', title: 'Building Your First Automation', duration: '8:45', thumbnail: '⚡', level: 'Beginner' },
  { id: '3', title: 'Advanced Agent Orchestration', duration: '22:15', thumbnail: '🧠', level: 'Advanced' },
  { id: '4', title: 'ESP32 Smart Sensor Setup', duration: '15:20', thumbnail: '📡', level: 'Intermediate' },
  { id: '5', title: 'Custom Plugin Development', duration: '18:00', thumbnail: '🔌', level: 'Advanced' },
  { id: '6', title: 'Data Pipeline Masterclass', duration: '25:30', thumbnail: '🔄', level: 'Advanced' },
];

const HelpCenter: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'articles' | 'faq' | 'tutorials'>('articles');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const filteredArticles = articles.filter(a =>
    (selectedCategory === 'all' || a.category === selectedCategory) &&
    (searchQuery === '' || a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.tags.some(t => t.includes(searchQuery.toLowerCase())))
  );

  const filteredFaqs = faqs.filter(f =>
    (selectedCategory === 'all' || f.category === selectedCategory) &&
    (searchQuery === '' || f.question.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 p-6">
      <FadeIn>
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3 justify-center">
            <BookOpen className="text-blue-500" size={32} />
            Help Center
          </h1>
          <p className="text-gray-500 mt-2">Find answers, guides, and tutorials for NexusAI</p>

          {/* Search */}
          <div className="relative mt-6">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search for help articles, FAQs, tutorials..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </FadeIn>

      {/* Popular Search Suggestions */}
      <FadeIn delay={0.05}>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Popular:</span>
          {['setup guide', 'api keys', 'automations', 'voice commands', 'backup'].map(term => (
            <button key={term} onClick={() => setSearchQuery(term)}
              className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              {term}
            </button>
          ))}
        </div>
      </FadeIn>

      {/* Category Grid */}
      <FadeIn delay={0.1}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {categories.map(cat => (
            <motion.button key={cat.id} whileHover={{ y: -4, scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedCategory(selectedCategory === cat.id ? 'all' : cat.id)}
              className={`p-4 rounded-xl border text-left transition-colors ${
                selectedCategory === cat.id
                  ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-500/10'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}>
              <div className={`w-8 h-8 rounded-lg ${cat.color} text-white flex items-center justify-center mb-2`}>
                {cat.icon}
              </div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">{cat.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{cat.count} articles</div>
            </motion.button>
          ))}
        </div>
      </FadeIn>

      {/* Tabs */}
      <FadeIn delay={0.15}>
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
          {[
            { key: 'articles', label: 'Articles', icon: <FileText size={14} /> },
            { key: 'faq', label: 'FAQ', icon: <HelpCircle size={14} /> },
            { key: 'tutorials', label: 'Tutorials', icon: <Video size={14} /> },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}>{tab.icon} {tab.label}</button>
          ))}
        </div>
      </FadeIn>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'articles' && (
          <motion.div key="articles" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {selectedArticle ? (
              <FadeIn>
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
                  <button onClick={() => setSelectedArticle(null)}
                    className="flex items-center gap-1 text-blue-500 text-sm mb-4 hover:underline">
                    <ChevronRight size={14} className="rotate-180" /> Back to articles
                  </button>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{selectedArticle.title}</h2>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-6">
                    <span className="flex items-center gap-1"><Clock size={12} /> {selectedArticle.readTime} read</span>
                    <span>{selectedArticle.views.toLocaleString()} views</span>
                    <span className="flex items-center gap-1"><ThumbsUp size={12} /> {selectedArticle.helpful} found helpful</span>
                  </div>
                  <div className="prose dark:prose-invert max-w-none">
                    <p className="text-gray-700 dark:text-gray-300">{selectedArticle.summary}</p>
                    <p className="text-gray-600 dark:text-gray-400 mt-4">{selectedArticle.content}</p>
                    <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-4 mt-6 border border-blue-200 dark:border-blue-500/30">
                      <h4 className="font-medium text-blue-800 dark:text-blue-300 flex items-center gap-2 text-sm">
                        <Lightbulb size={14} /> Pro Tip
                      </h4>
                      <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                        Check the API Playground to test endpoints interactively before implementing them in your code.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-sm text-gray-500">Was this helpful?</span>
                    <button className="px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-500/10 text-green-600 text-sm flex items-center gap-1">
                      <ThumbsUp size={14} /> Yes
                    </button>
                    <button className="px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 text-sm flex items-center gap-1">
                      <ThumbsDown size={14} /> No
                    </button>
                  </div>
                </div>
              </FadeIn>
            ) : (
              <div className="space-y-3">
                {filteredArticles.map(article => (
                  <motion.div key={article.id} whileHover={{ x: 4 }}
                    onClick={() => setSelectedArticle(article)}
                    className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{article.title}</h3>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">{article.summary}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[10px] text-gray-500 flex items-center gap-1"><Clock size={10} /> {article.readTime}</span>
                          <span className="text-[10px] text-gray-500">{article.views.toLocaleString()} views</span>
                          {article.tags.map(t => (
                            <span key={t} className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[10px] text-gray-500">{t}</span>
                          ))}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-400 ml-3" />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'faq' && (
          <motion.div key="faq" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="space-y-2">
            {filteredFaqs.map(faq => (
              <div key={faq.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <button onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                  className="w-full p-4 text-left flex items-center gap-3">
                  <ChevronDown size={14} className={`text-gray-400 transition-transform flex-shrink-0 ${expandedFaq === faq.id ? 'rotate-180' : ''}`} />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{faq.question}</span>
                </button>
                <AnimatePresence>
                  {expandedFaq === faq.id && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                      className="overflow-hidden">
                      <div className="px-4 pb-4 pl-11">
                        <p className="text-sm text-gray-600 dark:text-gray-400">{faq.answer}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </motion.div>
        )}

        {activeTab === 'tutorials' && (
          <motion.div key="tutorials" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tutorials.map(tutorial => (
              <motion.div key={tutorial.id} whileHover={{ y: -4 }}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer group">
                <div className="h-32 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-4xl relative">
                  {tutorial.thumbnail}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <Play size={32} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{tutorial.title}</h3>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-gray-500 flex items-center gap-1"><Clock size={10} /> {tutorial.duration}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      tutorial.level === 'Beginner' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' :
                      tutorial.level === 'Intermediate' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' :
                      'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                    }`}>{tutorial.level}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contact Support */}
      <FadeIn delay={0.25}>
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 text-white text-center">
          <h3 className="text-lg font-bold mb-2">Still need help?</h3>
          <p className="text-sm text-white/80 mb-4">Our AI assistant is available 24/7 to help you with any questions.</p>
          <div className="flex items-center justify-center gap-3">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="px-4 py-2 bg-white text-blue-600 rounded-xl text-sm font-medium flex items-center gap-2">
              <MessageSquare size={14} /> Chat with AI
            </motion.button>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="px-4 py-2 bg-white/20 text-white rounded-xl text-sm font-medium flex items-center gap-2">
              <Globe size={14} /> Community Forum
            </motion.button>
          </div>
        </div>
      </FadeIn>
    </div>
  );
};

export default HelpCenter;
