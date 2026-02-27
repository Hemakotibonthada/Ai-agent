import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Bell,
  Mic,
  MicOff,
  Command,
  Cpu,
  HardDrive,
  ChevronDown,
  Settings,
  LogOut,
  User,
} from 'lucide-react';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import Tooltip from '../ui/Tooltip';
import CommandPalette from '../ui/CommandPalette';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface HeaderProps {
  onNavigate?: (path: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function Header({ onNavigate }: HeaderProps) {
  const [time, setTime] = useState(new Date());
  const [voiceActive, setVoiceActive] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const formattedTime = time.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const formattedDate = time.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <>
      <header
        className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4
                   border-b border-nexus-border/40 bg-nexus-surface/30 px-5 backdrop-blur-xl"
      >
        {/* ---- Search / Command trigger ---- */}
        <button
          onClick={() => setCmdOpen(true)}
          className="flex items-center gap-2.5 rounded-lg border border-nexus-border bg-nexus-bg/50
                     px-3 py-1.5 text-sm text-nexus-muted transition hover:border-nexus-primary/40 hover:bg-nexus-card/5
                     focus-ring w-64"
        >
          <Search size={14} />
          <span className="flex-1 text-left">Search or command…</span>
          <kbd className="rounded border border-nexus-border bg-nexus-surface px-1.5 py-0.5 text-[10px]">
            <Command size={10} className="inline" /> K
          </kbd>
        </button>

        {/* ---- Center: System stats ---- */}
        <div className="hidden items-center gap-5 md:flex">
          <Tooltip content="CPU Usage">
            <div className="flex items-center gap-1.5 text-xs text-nexus-muted">
              <Cpu size={13} className="text-nexus-primary" />
              <span className="tabular-nums">24%</span>
              <div className="h-1 w-12 overflow-hidden rounded-full bg-nexus-border/50">
                <div className="h-full w-[24%] rounded-full bg-nexus-primary" style={{ boxShadow: '0 0 6px rgba(59,130,246,.5)' }} />
              </div>
            </div>
          </Tooltip>
          <Tooltip content="RAM Usage">
            <div className="flex items-center gap-1.5 text-xs text-nexus-muted">
              <HardDrive size={13} className="text-nexus-secondary" />
              <span className="tabular-nums">61%</span>
              <div className="h-1 w-12 overflow-hidden rounded-full bg-nexus-border/50">
                <div className="h-full w-[61%] rounded-full bg-nexus-secondary" style={{ boxShadow: '0 0 6px rgba(139,92,246,.5)' }} />
              </div>
            </div>
          </Tooltip>
        </div>

        {/* ---- Right side ---- */}
        <div className="flex items-center gap-3">
          {/* Time */}
          <div className="hidden flex-col items-end text-right lg:flex">
            <span className="text-xs font-semibold tabular-nums text-nexus-text">{formattedTime}</span>
            <span className="text-[10px] text-nexus-muted">{formattedDate}</span>
          </div>

          <div className="h-5 w-px bg-nexus-border/50 hidden lg:block" />

          {/* Voice toggle */}
          <Tooltip content={voiceActive ? 'Mute Voice' : 'Activate Voice'}>
            <button
              onClick={() => setVoiceActive(!voiceActive)}
              className={`
                rounded-lg p-2 transition focus-ring
                ${voiceActive
                  ? 'bg-nexus-primary/20 text-nexus-primary neon-blue'
                  : 'text-nexus-muted hover:bg-nexus-card/5 hover:text-nexus-text'
                }
              `}
            >
              {voiceActive ? <Mic size={16} /> : <MicOff size={16} />}
            </button>
          </Tooltip>

          {/* Notifications */}
          <Tooltip content="Notifications">
            <button className="relative rounded-lg p-2 text-nexus-muted transition hover:bg-nexus-card/5 hover:text-nexus-text focus-ring">
              <Bell size={16} />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-nexus-error animate-pulse" />
            </button>
          </Tooltip>

          <div className="h-5 w-px bg-nexus-border/50" />

          {/* User avatar + dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 rounded-lg p-1 transition hover:bg-nexus-card/5 focus-ring"
            >
              <Avatar fallback="NX" size="xs" status="online" />
              <ChevronDown size={12} className="text-nexus-muted hidden sm:block" />
            </button>

            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="absolute right-0 top-full z-50 mt-2 w-48 rounded-xl border border-nexus-border
                             bg-nexus-surface/95 p-1.5 shadow-xl backdrop-blur-xl"
                >
                  {[
                    { label: 'Profile', icon: User },
                    { label: 'Settings', icon: Settings },
                    { label: 'Sign Out', icon: LogOut },
                  ].map((item) => (
                    <button
                      key={item.label}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-nexus-muted
                                 transition hover:bg-nexus-card/5 hover:text-nexus-text"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <item.icon size={14} />
                      {item.label}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Command Palette */}
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} onNavigate={onNavigate} />
    </>
  );
}
