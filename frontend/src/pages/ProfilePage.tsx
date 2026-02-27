import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Mail, Phone, MapPin, Camera, Edit3, Save,
  Shield, Key, Bell, Globe, Palette, Clock, Award,
  Activity, Star, Settings, ChevronRight, Lock,
  Eye, EyeOff, Upload, Check, X, Zap, Target,
  Calendar, MessageSquare, Code, BookOpen
} from 'lucide-react';
import { FadeIn } from '../lib/animations';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  earned: boolean;
  date?: string;
}

const ProfilePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'preferences' | 'achievements'>('profile');
  const [editing, setEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [profile, setProfile] = useState({
    name: 'Admin User',
    email: 'admin@nexusai.local',
    phone: '+1 (555) 123-4567',
    location: 'San Francisco, CA',
    role: 'System Administrator',
    bio: 'Building the future of AI-powered personal assistants. Passionate about automation, smart homes, and machine learning.',
    timezone: 'America/Los_Angeles',
    language: 'English',
    joinDate: '2024-01-15',
    lastActive: '2 minutes ago',
  });

  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    sms: false,
    security: true,
    updates: true,
    marketing: false,
    weekly: true,
    realtime: true,
  });

  const stats = [
    { label: 'Tasks Completed', value: '1,247', icon: <Target size={16} />, color: 'text-blue-500' },
    { label: 'Agent Interactions', value: '8,432', icon: <MessageSquare size={16} />, color: 'text-purple-500' },
    { label: 'Days Active', value: '89', icon: <Calendar size={16} />, color: 'text-green-500' },
    { label: 'Automations Run', value: '3,891', icon: <Zap size={16} />, color: 'text-orange-500' },
  ];

  const activityTimeline = [
    { action: 'Configured Smart Home automation', time: '2 hours ago', icon: <Settings size={14} /> },
    { action: 'Deployed Security Agent update', time: '5 hours ago', icon: <Shield size={14} /> },
    { action: 'Created ETL Pipeline "user-analytics"', time: '1 day ago', icon: <Code size={14} /> },
    { action: 'Generated monthly health report', time: '2 days ago', icon: <Activity size={14} /> },
    { action: 'Updated AI model preferences', time: '3 days ago', icon: <Zap size={14} /> },
    { action: 'Added new workflow "Security Alert"', time: '5 days ago', icon: <Target size={14} /> },
    { action: 'Completed feature flag rollout', time: '1 week ago', icon: <Check size={14} /> },
    { action: 'Installed plugin "Weather Integration"', time: '1 week ago', icon: <Globe size={14} /> },
  ];

  const achievements: Achievement[] = [
    { id: '1', name: 'Early Adopter', description: 'Joined on launch day', icon: <Star size={20} />, color: 'from-yellow-400 to-orange-400', earned: true, date: 'Jan 15, 2024' },
    { id: '2', name: 'Automation Master', description: 'Run 1000+ automations', icon: <Zap size={20} />, color: 'from-blue-400 to-cyan-400', earned: true, date: 'Feb 28, 2024' },
    { id: '3', name: 'Security Expert', description: 'Pass 10 security audits', icon: <Shield size={20} />, color: 'from-green-400 to-emerald-400', earned: true, date: 'Mar 5, 2024' },
    { id: '4', name: 'Data Wizard', description: 'Process 100K records', icon: <Activity size={20} />, color: 'from-purple-400 to-pink-400', earned: true, date: 'Mar 10, 2024' },
    { id: '5', name: 'Plugin Pioneer', description: 'Install 10+ plugins', icon: <Code size={20} />, color: 'from-indigo-400 to-blue-400', earned: false },
    { id: '6', name: 'AI Whisperer', description: '10K+ agent conversations', icon: <MessageSquare size={20} />, color: 'from-pink-400 to-rose-400', earned: false },
    { id: '7', name: 'Night Owl', description: 'Active past midnight 30 times', icon: <Clock size={20} />, color: 'from-gray-400 to-gray-500', earned: true, date: 'Mar 8, 2024' },
    { id: '8', name: 'Knowledge Seeker', description: 'Read all documentation', icon: <BookOpen size={20} />, color: 'from-teal-400 to-cyan-400', earned: false },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header Card */}
      <FadeIn>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Cover */}
          <div className="h-32 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 relative">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiLz48L3N2Zz4=')] opacity-50" />
          </div>

          {/* Profile Info */}
          <div className="px-6 pb-6 -mt-12">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
              <div className="relative">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-3xl font-bold border-4 border-white dark:border-gray-800 shadow-lg">
                  AU
                </div>
                <button className="absolute bottom-0 right-0 p-1.5 bg-blue-500 text-white rounded-lg shadow-lg hover:bg-blue-600">
                  <Camera size={12} />
                </button>
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{profile.name}</h1>
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <Shield size={12} className="text-blue-500" /> {profile.role}
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded text-xs">Active</span>
                </p>
              </div>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => setEditing(!editing)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600">
                {editing ? <><Save size={14} /> Save Profile</> : <><Edit3 size={14} /> Edit Profile</>}
              </motion.button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              {stats.map(stat => (
                <div key={stat.label} className="text-center p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                  <div className={`${stat.color} mb-1 flex justify-center`}>{stat.icon}</div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
                  <div className="text-xs text-gray-500">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        {(['profile', 'security', 'preferences', 'achievements'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'
            }`}>{tab}</button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <FadeIn delay={0.1} className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Personal Information</h3>
              {[
                { label: 'Full Name', value: profile.name, icon: <User size={16} /> },
                { label: 'Email', value: profile.email, icon: <Mail size={16} /> },
                { label: 'Phone', value: profile.phone, icon: <Phone size={16} /> },
                { label: 'Location', value: profile.location, icon: <MapPin size={16} /> },
                { label: 'Timezone', value: profile.timezone, icon: <Clock size={16} /> },
                { label: 'Language', value: profile.language, icon: <Globe size={16} /> },
              ].map(field => (
                <div key={field.label} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                  <span className="text-gray-400">{field.icon}</span>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500">{field.label}</label>
                    {editing ? (
                      <input type="text" defaultValue={field.value}
                        className="w-full bg-transparent text-sm text-gray-900 dark:text-white outline-none border-b border-gray-300 dark:border-gray-600 focus:border-blue-500" />
                    ) : (
                      <p className="text-sm text-gray-900 dark:text-white">{field.value}</p>
                    )}
                  </div>
                </div>
              ))}
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                <label className="text-xs text-gray-500">Bio</label>
                {editing ? (
                  <textarea defaultValue={profile.bio} rows={3}
                    className="w-full bg-transparent text-sm text-gray-900 dark:text-white outline-none resize-none mt-1" />
                ) : (
                  <p className="text-sm text-gray-900 dark:text-white mt-1">{profile.bio}</p>
                )}
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h3>
              <div className="space-y-4">
                {activityTimeline.map((item, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500">{item.icon}</div>
                      {i < activityTimeline.length - 1 && <div className="w-px h-full bg-gray-200 dark:bg-gray-700 mt-1" />}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm text-gray-900 dark:text-white">{item.action}</p>
                      <p className="text-xs text-gray-500">{item.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      )}

      {activeTab === 'security' && (
        <FadeIn delay={0.1}>
          <div className="max-w-2xl space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Lock size={16} className="text-blue-500" /> Password
              </h3>
              {['Current Password', 'New Password', 'Confirm Password'].map(label => (
                <div key={label} className="relative">
                  <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                  <input type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={showPassword} onChange={e => setShowPassword(e.target.checked)} className="rounded" />
                <span className="text-sm text-gray-500">Show passwords</span>
              </div>
              <button className="px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600">Update Password</button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Shield size={16} className="text-green-500" /> Two-Factor Authentication
              </h3>
              <p className="text-sm text-gray-500">Secure your account with TOTP-based 2FA</p>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-lg text-sm font-medium">
                <Check size={14} /> Enabled
              </span>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Key size={16} className="text-purple-500" /> API Keys
              </h3>
              <div className="space-y-2">
                {[
                  { name: 'Production Key', created: 'Jan 15, 2024', lastUsed: '2 min ago' },
                  { name: 'Development Key', created: 'Feb 1, 2024', lastUsed: '1 day ago' },
                ].map(key => (
                  <div key={key.name} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{key.name}</p>
                      <p className="text-xs text-gray-500">Created {key.created} · Last used {key.lastUsed}</p>
                    </div>
                    <button className="text-xs text-red-500 hover:text-red-600">Revoke</button>
                  </div>
                ))}
              </div>
              <button className="flex items-center gap-2 text-sm text-blue-500 hover:text-blue-600">
                <Key size={14} /> Generate New API Key
              </button>
            </div>
          </div>
        </FadeIn>
      )}

      {activeTab === 'preferences' && (
        <FadeIn delay={0.1}>
          <div className="max-w-2xl bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 space-y-6">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Bell size={16} className="text-orange-500" /> Notification Preferences
            </h3>
            {[
              { key: 'email', label: 'Email Notifications', desc: 'Receive notifications via email' },
              { key: 'push', label: 'Push Notifications', desc: 'Browser push notifications' },
              { key: 'sms', label: 'SMS Notifications', desc: 'Text message alerts' },
              { key: 'security', label: 'Security Alerts', desc: 'Login attempts, suspicious activity' },
              { key: 'updates', label: 'System Updates', desc: 'New features and improvements' },
              { key: 'weekly', label: 'Weekly Digest', desc: 'Summary of activity each week' },
              { key: 'realtime', label: 'Real-time Alerts', desc: 'Immediate notifications for critical events' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</p>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </div>
                <button
                  onClick={() => setNotifications(prev => ({ ...prev, [item.key]: !prev[item.key as keyof typeof prev] }))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${notifications[item.key as keyof typeof notifications] ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <motion.div
                    animate={{ x: notifications[item.key as keyof typeof notifications] ? 20 : 2 }}
                    className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow"
                  />
                </button>
              </div>
            ))}
          </div>
        </FadeIn>
      )}

      {activeTab === 'achievements' && (
        <FadeIn delay={0.1}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {achievements.map((ach, i) => (
              <motion.div key={ach.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -4 }}
                className={`bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 text-center ${!ach.earned ? 'opacity-50' : ''}`}
              >
                <div className={`w-14 h-14 mx-auto mb-3 rounded-xl bg-gradient-to-br ${ach.color} flex items-center justify-center text-white ${!ach.earned ? 'grayscale' : ''}`}>
                  {ach.icon}
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{ach.name}</h4>
                <p className="text-xs text-gray-500 mt-1">{ach.description}</p>
                {ach.earned ? (
                  <span className="inline-flex items-center gap-1 mt-2 text-xs text-green-500">
                    <Check size={10} /> {ach.date}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 mt-2 text-xs text-gray-400">
                    <Lock size={10} /> Locked
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </FadeIn>
      )}
    </div>
  );
};

export default ProfilePage;
