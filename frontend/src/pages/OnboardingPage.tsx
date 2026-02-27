import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Rocket, ArrowRight, ArrowLeft, Check, X, Brain, Home,
  Shield, Heart, Mic, Settings, Zap, Star, Users, Globe,
  ChevronRight, Sparkles, Target, BookOpen, Bell, Code,
  Lightbulb, MessageSquare, BarChart3
} from 'lucide-react';
import { FadeIn } from '../lib/animations';

const steps = [
  {
    id: 'welcome',
    title: 'Welcome to NexusAI',
    subtitle: 'Your personal AI-powered life operating system',
    description: 'NexusAI brings together intelligent agents, smart home control, health monitoring, and more — all running locally on your hardware.',
    icon: <Sparkles size={48} />,
    color: 'from-blue-500 to-purple-600',
    features: [
      { icon: <Brain size={16} />, text: '15 Specialized AI Agents' },
      { icon: <Home size={16} />, text: 'Smart Home Integration' },
      { icon: <Shield size={16} />, text: 'Privacy-First Architecture' },
      { icon: <Zap size={16} />, text: 'Real-Time Automations' },
    ],
  },
  {
    id: 'agents',
    title: 'Meet Your AI Agents',
    subtitle: 'Specialized agents for every aspect of your life',
    description: 'Each agent is an expert in its domain, working together through the Orchestrator to handle complex tasks seamlessly.',
    icon: <Brain size={48} />,
    color: 'from-purple-500 to-pink-600',
    agents: [
      { name: 'Personal Agent', desc: 'Your AI assistant for daily tasks', icon: '🤖' },
      { name: 'Home Agent', desc: 'Smart home control and automation', icon: '🏠' },
      { name: 'Health Agent', desc: 'Track wellness, fitness, and sleep', icon: '❤️' },
      { name: 'Security Agent', desc: 'Monitor threats and privacy', icon: '🛡️' },
      { name: 'Financial Agent', desc: 'Budget tracking and insights', icon: '💰' },
      { name: 'Voice Agent', desc: 'Natural voice interaction', icon: '🎤' },
      { name: 'Work Agent', desc: 'Productivity and scheduling', icon: '💼' },
      { name: 'Learning Agent', desc: 'Personalized knowledge building', icon: '📚' },
    ],
  },
  {
    id: 'features',
    title: 'Explore Key Features',
    subtitle: 'Everything you need in one unified platform',
    description: 'From the powerful dashboard to advanced data pipelines, every feature is designed for speed, security, and simplicity.',
    icon: <Star size={48} />,
    color: 'from-green-500 to-teal-600',
    featureGrid: [
      { icon: <BarChart3 size={20} />, title: 'Analytics', desc: 'Real-time metrics and insights' },
      { icon: <Zap size={20} />, title: 'Automations', desc: 'Smart triggers and workflows' },
      { icon: <Code size={20} />, title: 'API Playground', desc: 'Test and explore APIs' },
      { icon: <Bell size={20} />, title: 'Notifications', desc: 'Smart alert management' },
      { icon: <Target size={20} />, title: 'Task Manager', desc: 'Kanban boards and lists' },
      { icon: <Globe size={20} />, title: 'Network Monitor', desc: 'Device and traffic analysis' },
    ],
  },
  {
    id: 'customize',
    title: 'Personalize Your Experience',
    subtitle: 'Make NexusAI work exactly how you want',
    description: 'Choose your preferences to get the most out of NexusAI from day one.',
    icon: <Settings size={48} />,
    color: 'from-orange-500 to-red-600',
    preferences: [
      { id: 'theme', label: 'Theme', options: ['Dark', 'Light', 'System'], default: 0 },
      { id: 'voice', label: 'Voice Assistant', options: ['Enabled', 'Disabled'], default: 0 },
      { id: 'notifications', label: 'Notifications', options: ['All', 'Important', 'Minimal'], default: 1 },
      { id: 'layout', label: 'Dashboard Layout', options: ['Compact', 'Comfortable', 'Spacious'], default: 1 },
    ],
  },
  {
    id: 'ready',
    title: "You're All Set!",
    subtitle: 'Start exploring NexusAI right now',
    description: 'Your AI-powered life OS is ready to go. Explore the dashboard, chat with your agents, or set up your first automation.',
    icon: <Rocket size={48} />,
    color: 'from-blue-600 to-indigo-700',
    quickStart: [
      { icon: <MessageSquare size={16} />, label: 'Chat with AI', path: '/chat' },
      { icon: <BarChart3 size={16} />, label: 'View Dashboard', path: '/' },
      { icon: <Zap size={16} />, label: 'Create Automation', path: '/automations' },
      { icon: <BookOpen size={16} />, label: 'Read Help Docs', path: '/help' },
    ],
  },
];

const OnboardingPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedPrefs, setSelectedPrefs] = useState<Record<string, number>>({
    theme: 0, voice: 0, notifications: 1, layout: 1,
  });
  const [direction, setDirection] = useState(1);
  const [skipped, setSkipped] = useState(false);

  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  const goNext = () => {
    if (!isLast) {
      setDirection(1);
      setCurrentStep(prev => prev + 1);
    }
  };

  const goPrev = () => {
    if (!isFirst) {
      setDirection(-1);
      setCurrentStep(prev => prev - 1);
    }
  };

  if (skipped) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <FadeIn>
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-green-500 text-white flex items-center justify-center mx-auto mb-4">
              <Check size={32} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Setup Complete!</h2>
            <p className="text-gray-500 mt-2">You can always revisit this guide from Settings.</p>
          </div>
        </FadeIn>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex flex-col p-6">
      {/* Progress Bar */}
      <FadeIn>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            {steps.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2">
                <motion.div
                  animate={{ scale: i === currentStep ? 1.2 : 1 }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    i < currentStep ? 'bg-green-500 text-white' :
                    i === currentStep ? 'bg-blue-500 text-white' :
                    'bg-gray-200 dark:bg-gray-700 text-gray-500'
                  }`}>
                  {i < currentStep ? <Check size={14} /> : i + 1}
                </motion.div>
                {i < steps.length - 1 && (
                  <div className={`w-8 h-0.5 ${i < currentStep ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                )}
              </div>
            ))}
          </div>
          <button onClick={() => setSkipped(true)}
            className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            Skip tour
          </button>
        </div>
      </FadeIn>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: direction * 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -100 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-3xl"
          >
            {/* Header */}
            <div className="text-center mb-8">
              <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${step.color} text-white flex items-center justify-center mx-auto mb-4 shadow-lg`}>
                {step.icon}
              </div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{step.title}</h1>
              <p className="text-lg text-blue-500 mt-1">{step.subtitle}</p>
              <p className="text-gray-500 mt-3 max-w-lg mx-auto">{step.description}</p>
            </div>

            {/* Step-specific content */}
            {step.id === 'welcome' && step.features && (
              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                {step.features.map((f, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * i }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <div className="text-blue-500">{f.icon}</div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{f.text}</span>
                  </motion.div>
                ))}
              </div>
            )}

            {step.id === 'agents' && step.agents && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {step.agents.map((agent, i) => (
                  <motion.div key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.05 * i }}
                    className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-center hover:border-purple-300 dark:hover:border-purple-600 transition-colors">
                    <div className="text-2xl mb-2">{agent.icon}</div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{agent.name}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{agent.desc}</div>
                  </motion.div>
                ))}
              </div>
            )}

            {step.id === 'features' && step.featureGrid && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {step.featureGrid.map((f, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 * i }}
                    className="p-5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
                    <div className="text-green-500 mb-3">{f.icon}</div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">{f.title}</div>
                    <div className="text-xs text-gray-500 mt-1">{f.desc}</div>
                  </motion.div>
                ))}
              </div>
            )}

            {step.id === 'customize' && step.preferences && (
              <div className="space-y-4 max-w-md mx-auto">
                {step.preferences.map((pref, i) => (
                  <motion.div key={pref.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * i }}
                    className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">{pref.label}</label>
                    <div className="flex gap-2">
                      {pref.options.map((opt, oi) => (
                        <button key={opt} onClick={() => setSelectedPrefs({ ...selectedPrefs, [pref.id]: oi })}
                          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                            selectedPrefs[pref.id] === oi
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}>{opt}</button>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {step.id === 'ready' && step.quickStart && (
              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                {step.quickStart.map((action, i) => (
                  <motion.button key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * i }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center gap-3 hover:border-blue-300 dark:hover:border-blue-600 transition-all">
                    <div className="text-blue-500">{action.icon}</div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{action.label}</span>
                    <ArrowRight size={14} className="ml-auto text-gray-400" />
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={goPrev} disabled={isFirst}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${
            isFirst ? 'invisible' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}>
          <ArrowLeft size={14} /> Previous
        </motion.button>

        <div className="flex gap-1.5">
          {steps.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-colors ${
              i === currentStep ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
            }`} />
          ))}
        </div>

        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={isLast ? () => setSkipped(true) : goNext}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white ${
            isLast ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-500 hover:bg-blue-600'
          }`}>
          {isLast ? 'Get Started' : 'Next'} <ArrowRight size={14} />
        </motion.button>
      </div>
    </div>
  );
};

export default OnboardingPage;
