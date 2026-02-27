/* ===================================================================
   Nexus AI OS — Settings Page
   Tabbed settings: Profile, AI, Voice, Home, Notifications, Privacy, System
   =================================================================== */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Brain,
  Mic,
  Home,
  Bell,
  Shield,
  Settings as SettingsIcon,
  Upload,
  Save,
  Trash2,
  Download,
  RefreshCw,
  Eye,
  EyeOff,
  Terminal,
  Volume2,
  Wifi,
  Database,
  Lock,
  Key,
  Cpu,
  Palette,
  Globe,
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Info,
  HardDrive,
} from 'lucide-react';

import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Switch from '@/components/ui/Switch';
import Slider from '@/components/ui/Slider';
import Tabs from '@/components/ui/Tabs';
import Avatar from '@/components/ui/Avatar';
import useStore from '@/lib/store';
import { systemApi, voiceApi } from '@/lib/api';

/* ------------------------------------------------------------------ */
/*  Animations                                                         */
/* ------------------------------------------------------------------ */
const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

/* ------------------------------------------------------------------ */
/*  Tab definitions                                                    */
/* ------------------------------------------------------------------ */
const settingsTabs = [
  { value: 'profile', label: 'Profile', icon: User },
  { value: 'ai', label: 'AI & Models', icon: Brain },
  { value: 'voice', label: 'Voice', icon: Mic },
  { value: 'home', label: 'Home / IoT', icon: Home },
  { value: 'notifications', label: 'Notifications', icon: Bell },
  { value: 'privacy', label: 'Privacy', icon: Shield },
  { value: 'system', label: 'System', icon: SettingsIcon },
];

/* ------------------------------------------------------------------ */
/*  Settings Section Wrapper                                           */
/* ------------------------------------------------------------------ */
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div {...fadeIn} className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-nexus-text">{title}</h3>
        {description && <p className="text-xs text-nexus-muted mt-0.5">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </motion.div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-nexus-border bg-nexus-card/40 p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-nexus-text">{label}</p>
        {description && <p className="text-[11px] text-nexus-muted mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function Settings() {
  const { setCurrentPage, theme, setTheme } = useStore();
  const [activeTab, setActiveTab] = useState('profile');

  /* Profile state */
  const [name, setName] = useState('Nexus User');
  const [email, setEmail] = useState('user@nexus.ai');
  const [personality, setPersonality] = useState('friendly');

  /* AI state */
  const [model, setModel] = useState('nexus-7b');
  const [temperature, setTemperature] = useState([0.7]);
  const [systemPrompt, setSystemPrompt] = useState('You are Nexus, a helpful futuristic AI assistant.');
  const [autoTrain, setAutoTrain] = useState(true);

  /* Voice state */
  const [ttsVoice, setTtsVoice] = useState('alloy');
  const [speechRate, setSpeechRate] = useState([1.0]);
  const [wakeWord, setWakeWord] = useState('Hey Nexus');
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  /* Home state */
  const [mqttUrl, setMqttUrl] = useState('mqtt://192.168.1.100:1883');
  const [mqttUser, setMqttUser] = useState('nexus');

  /* Notifications */
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifPush, setNotifPush] = useState(true);
  const [notifSound, setNotifSound] = useState(true);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);

  /* Privacy */
  const [encryptionEnabled, setEncryptionEnabled] = useState(true);
  const [dataRetention, setDataRetention] = useState('90');

  /* System */
  const [autoStart, setAutoStart] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [cpuLimit, setCpuLimit] = useState([80]);

  useEffect(() => {
    setCurrentPage('/settings');
  }, [setCurrentPage]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 pb-8"
    >
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-nexus-text flex items-center gap-2">
          <SettingsIcon size={24} className="text-nexus-muted" />
          Settings
        </h1>
        <p className="text-sm text-nexus-muted mt-0.5">Configure your Nexus AI assistant</p>
      </div>

      {/* ── Tabs Layout ── */}
      <Tabs
        items={settingsTabs}
        value={activeTab}
        onValueChange={setActiveTab}
        variant="vertical"
      >
        <div className="flex-1 min-w-0 space-y-6">
          {/* ═══════════════════════════ PROFILE ═══════════════════════════ */}
          {activeTab === 'profile' && (
            <Section title="Profile" description="Manage your personal information">
              <Card>
                <div className="flex items-center gap-4 mb-6">
                  <Avatar fallback={name} size="xl" glow />
                  <div>
                    <p className="text-sm font-medium text-nexus-text">{name}</p>
                    <p className="text-xs text-nexus-muted">{email}</p>
                    <Button variant="ghost" size="sm" icon={Upload} className="mt-1">
                      Upload Avatar
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
                  <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />

                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider text-nexus-muted">Personality Style</label>
                    <select
                      value={personality}
                      onChange={(e) => setPersonality(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-nexus-border bg-nexus-surface/60 px-3 py-2 text-sm text-nexus-text focus-ring"
                    >
                      <option value="friendly">Friendly & Casual</option>
                      <option value="professional">Professional</option>
                      <option value="concise">Concise & Direct</option>
                      <option value="creative">Creative & Expressive</option>
                    </select>
                  </div>

                  <Button variant="primary" icon={Save}>Save Changes</Button>
                </div>
              </Card>
            </Section>
          )}

          {/* ═══════════════════════════ AI & MODELS ═══════════════════════ */}
          {activeTab === 'ai' && (
            <Section title="AI & Models" description="Configure AI model parameters and training">
              <Card>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider text-nexus-muted">Model</label>
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-nexus-border bg-nexus-surface/60 px-3 py-2 text-sm text-nexus-text focus-ring"
                    >
                      <option value="nexus-7b">Nexus 7B (Local)</option>
                      <option value="nexus-13b">Nexus 13B (Local)</option>
                      <option value="gpt-4">GPT-4 (API)</option>
                      <option value="claude">Claude (API)</option>
                    </select>
                  </div>

                  <Slider
                    value={temperature}
                    onValueChange={setTemperature}
                    min={0}
                    max={2}
                    step={0.1}
                    label="Temperature"
                    showValue
                  />

                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider text-nexus-muted">System Prompt</label>
                    <textarea
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      rows={4}
                      className="mt-1.5 w-full rounded-lg border border-nexus-border bg-nexus-surface/60 px-3 py-2 text-sm text-nexus-text placeholder:text-nexus-muted/60 resize-none focus-ring"
                    />
                  </div>

                  <SettingRow label="Auto-train on interactions" description="Continuously improve from your usage patterns">
                    <Switch checked={autoTrain} onCheckedChange={setAutoTrain} />
                  </SettingRow>

                  <Button variant="primary" icon={Save}>Save Model Settings</Button>
                </div>
              </Card>
            </Section>
          )}

          {/* ═══════════════════════════ VOICE ═══════════════════════════ */}
          {activeTab === 'voice' && (
            <Section title="Voice" description="Configure text-to-speech and voice control">
              <Card>
                <div className="space-y-4">
                  <SettingRow label="Voice Assistant" description="Enable voice commands and responses">
                    <Switch checked={voiceEnabled} onCheckedChange={setVoiceEnabled} />
                  </SettingRow>

                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider text-nexus-muted">TTS Voice</label>
                    <select
                      value={ttsVoice}
                      onChange={(e) => setTtsVoice(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-nexus-border bg-nexus-surface/60 px-3 py-2 text-sm text-nexus-text focus-ring"
                    >
                      <option value="alloy">Alloy (Neutral)</option>
                      <option value="echo">Echo (Male)</option>
                      <option value="fable">Fable (Female)</option>
                      <option value="onyx">Onyx (Deep)</option>
                      <option value="nova">Nova (Soft)</option>
                    </select>
                  </div>

                  <Slider
                    value={speechRate}
                    onValueChange={setSpeechRate}
                    min={0.5}
                    max={2}
                    step={0.1}
                    label="Speech Rate"
                    showValue
                  />

                  <Input
                    label="Wake Word"
                    value={wakeWord}
                    onChange={(e) => setWakeWord(e.target.value)}
                    prefixIcon={Mic}
                  />

                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider text-nexus-muted">Trigger Words</label>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {['lights on', 'lights off', 'play music', 'set timer', 'lock doors'].map((w) => (
                        <Badge key={w} variant="neutral">{w}</Badge>
                      ))}
                      <button className="rounded-full border border-dashed border-nexus-border px-2.5 py-0.5 text-xs text-nexus-muted hover:text-nexus-text hover:border-nexus-primary/40 transition-colors">
                        + Add
                      </button>
                    </div>
                  </div>

                  <Button variant="primary" icon={Save}>Save Voice Settings</Button>
                </div>
              </Card>
            </Section>
          )}

          {/* ═══════════════════════════ HOME / IoT ═══════════════════════ */}
          {activeTab === 'home' && (
            <Section title="Home / IoT" description="Manage MQTT, ESP32, and smart devices">
              <Card>
                <div className="space-y-4">
                  <Input
                    label="MQTT Broker URL"
                    value={mqttUrl}
                    onChange={(e) => setMqttUrl(e.target.value)}
                    prefixIcon={Wifi}
                  />

                  <Input
                    label="MQTT Username"
                    value={mqttUser}
                    onChange={(e) => setMqttUser(e.target.value)}
                    prefixIcon={User}
                  />

                  <Input
                    label="MQTT Password"
                    type="password"
                    placeholder="••••••••"
                    prefixIcon={Lock}
                  />

                  <SettingRow label="ESP32 Auto-Discovery" description="Automatically detect new ESP32 devices on network">
                    <Switch checked={true} onCheckedChange={() => {}} />
                  </SettingRow>

                  <div className="rounded-lg border border-nexus-border bg-nexus-bg/60 p-4">
                    <h4 className="text-sm font-semibold text-nexus-text mb-2 flex items-center gap-2">
                      <Info size={14} className="text-nexus-accent" />
                      ESP32 Setup Guide
                    </h4>
                    <ol className="space-y-1.5 text-xs text-nexus-muted list-decimal pl-4">
                      <li>Flash the Nexus firmware to your ESP32 board</li>
                      <li>Connect ESP32 to your WiFi network</li>
                      <li>Enter MQTT broker details above</li>
                      <li>Devices will auto-register in the Home dashboard</li>
                    </ol>
                  </div>

                  <Button variant="primary" icon={Save}>Save IoT Settings</Button>
                </div>
              </Card>
            </Section>
          )}

          {/* ═══════════════════════════ NOTIFICATIONS ═══════════════════ */}
          {activeTab === 'notifications' && (
            <Section title="Notifications" description="Control how you receive alerts">
              <Card>
                <div className="space-y-3">
                  <SettingRow label="Email Notifications" description="Receive important updates via email">
                    <Switch checked={notifEmail} onCheckedChange={setNotifEmail} />
                  </SettingRow>
                  <SettingRow label="Push Notifications" description="Browser and desktop push alerts">
                    <Switch checked={notifPush} onCheckedChange={setNotifPush} />
                  </SettingRow>
                  <SettingRow label="Sound Effects" description="Play sounds for alerts and events">
                    <Switch checked={notifSound} onCheckedChange={setNotifSound} />
                  </SettingRow>
                  <SettingRow label="Quiet Hours" description="Mute notifications during set hours">
                    <Switch checked={quietHoursEnabled} onCheckedChange={setQuietHoursEnabled} />
                  </SettingRow>

                  {quietHoursEnabled && (
                    <motion.div {...fadeIn} className="grid grid-cols-2 gap-4 pl-4">
                      <Input label="From" type="time" defaultValue="22:00" />
                      <Input label="To" type="time" defaultValue="07:00" />
                    </motion.div>
                  )}

                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider text-nexus-muted">Alert Sound</label>
                    <select className="mt-1.5 w-full rounded-lg border border-nexus-border bg-nexus-surface/60 px-3 py-2 text-sm text-nexus-text focus-ring">
                      <option>Nexus Chime</option>
                      <option>System Default</option>
                      <option>Soft Bell</option>
                      <option>Digital Pulse</option>
                    </select>
                  </div>

                  <Button variant="primary" icon={Save}>Save Notification Settings</Button>
                </div>
              </Card>
            </Section>
          )}

          {/* ═══════════════════════════ PRIVACY ═══════════════════════ */}
          {activeTab === 'privacy' && (
            <Section title="Privacy & Security" description="Manage your data and security preferences">
              <Card>
                <div className="space-y-3">
                  <SettingRow label="End-to-End Encryption" description="Encrypt all stored data">
                    <Switch checked={encryptionEnabled} onCheckedChange={setEncryptionEnabled} />
                  </SettingRow>

                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider text-nexus-muted">Data Retention Period</label>
                    <select
                      value={dataRetention}
                      onChange={(e) => setDataRetention(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-nexus-border bg-nexus-surface/60 px-3 py-2 text-sm text-nexus-text focus-ring"
                    >
                      <option value="30">30 days</option>
                      <option value="90">90 days</option>
                      <option value="365">1 year</option>
                      <option value="forever">Forever</option>
                    </select>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-nexus-border/50">
                    <Button variant="accent" icon={Download} className="flex-1">
                      Export My Data
                    </Button>
                    <Button variant="danger" icon={Trash2} className="flex-1">
                      Delete All Data
                    </Button>
                  </div>
                </div>
              </Card>
            </Section>
          )}

          {/* ═══════════════════════════ SYSTEM ═══════════════════════ */}
          {activeTab === 'system' && (
            <Section title="System" description="System configuration and diagnostics">
              <Card>
                <div className="space-y-3">
                  <SettingRow label="Auto-Start on Boot" description="Launch Nexus when your system starts">
                    <Switch checked={autoStart} onCheckedChange={setAutoStart} />
                  </SettingRow>

                  <SettingRow label="Debug Mode" description="Enable verbose logging and diagnostics">
                    <Switch checked={debugMode} onCheckedChange={setDebugMode} />
                  </SettingRow>

                  <Slider
                    value={cpuLimit}
                    onValueChange={setCpuLimit}
                    min={10}
                    max={100}
                    step={5}
                    label="CPU Usage Limit"
                    showValue
                  />

                  <SettingRow label="Check for Updates" description="Current version: v2.1.0">
                    <Button variant="ghost" size="sm" icon={RefreshCw}>
                      Check
                    </Button>
                  </SettingRow>

                  {/* Logs Viewer */}
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider text-nexus-muted flex items-center gap-1">
                      <Terminal size={12} />
                      Recent Logs
                    </label>
                    <div className="mt-1.5 rounded-lg border border-nexus-border bg-nexus-bg/80 p-3 max-h-40 overflow-y-auto scrollbar-thin font-mono text-[11px] text-nexus-muted space-y-0.5">
                      <p><span className="text-emerald-400">[INFO]</span> System started successfully</p>
                      <p><span className="text-emerald-400">[INFO]</span> All agents initialized (10/10)</p>
                      <p><span className="text-blue-400">[DEBUG]</span> MQTT connection established</p>
                      <p><span className="text-amber-400">[WARN]</span> High memory usage detected (82%)</p>
                      <p><span className="text-emerald-400">[INFO]</span> Scheduled task completed: daily_cleanup</p>
                      <p><span className="text-blue-400">[DEBUG]</span> Voice engine ready</p>
                      <p><span className="text-emerald-400">[INFO]</span> Heartbeat OK — uptime: 72h 14m</p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-nexus-border/50">
                    <Button variant="ghost" icon={Download} className="flex-1">
                      Export Logs
                    </Button>
                    <Button variant="danger" icon={Trash2} size="sm">
                      Clear Logs
                    </Button>
                  </div>
                </div>
              </Card>
            </Section>
          )}
        </div>
      </Tabs>
    </motion.div>
  );
}
