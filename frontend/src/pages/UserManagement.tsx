import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, Plus, Shield, Mail, Key, Lock,
  Unlock, MoreHorizontal, UserPlus, UserMinus,
  Crown, Eye, Edit3, Trash2, X, CheckCircle,
  AlertTriangle, Clock, Filter, Download, Activity,
} from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer' | 'api';
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  avatar: string;
  lastActive: string;
  createdAt: string;
  mfaEnabled: boolean;
  apiKeys: number;
  sessions: number;
  permissions: string[];
}

const roleConfig = {
  admin: { color: 'text-red-400', bg: 'bg-red-500/10', icon: <Crown size={12} /> },
  editor: { color: 'text-blue-400', bg: 'bg-blue-500/10', icon: <Edit3 size={12} /> },
  viewer: { color: 'text-green-400', bg: 'bg-green-500/10', icon: <Eye size={12} /> },
  api: { color: 'text-purple-400', bg: 'bg-purple-500/10', icon: <Key size={12} /> },
};

const statusConfig = {
  active: { color: 'text-green-400', bg: 'bg-green-500/10', dot: '#10B981' },
  inactive: { color: 'text-gray-400', bg: 'bg-gray-500/10', dot: '#6B7280' },
  suspended: { color: 'text-red-400', bg: 'bg-red-500/10', dot: '#EF4444' },
  pending: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', dot: '#F59E0B' },
};

const sampleUsers: User[] = [
  { id: '1', name: 'Alex Morgan', email: 'alex@nexus.ai', role: 'admin', status: 'active', avatar: 'AM', lastActive: '2m ago', createdAt: '2024-01-15', mfaEnabled: true, apiKeys: 3, sessions: 2, permissions: ['all'] },
  { id: '2', name: 'Sarah Chen', email: 'sarah@nexus.ai', role: 'editor', status: 'active', avatar: 'SC', lastActive: '15m ago', createdAt: '2024-01-20', mfaEnabled: true, apiKeys: 1, sessions: 1, permissions: ['read', 'write', 'deploy'] },
  { id: '3', name: 'James Wilson', email: 'james@nexus.ai', role: 'viewer', status: 'active', avatar: 'JW', lastActive: '1h ago', createdAt: '2024-02-05', mfaEnabled: false, apiKeys: 0, sessions: 1, permissions: ['read'] },
  { id: '4', name: 'Maria Garcia', email: 'maria@nexus.ai', role: 'editor', status: 'active', avatar: 'MG', lastActive: '30m ago', createdAt: '2024-02-10', mfaEnabled: true, apiKeys: 2, sessions: 3, permissions: ['read', 'write'] },
  { id: '5', name: 'David Kim', email: 'david@nexus.ai', role: 'api', status: 'active', avatar: 'DK', lastActive: '5m ago', createdAt: '2024-02-15', mfaEnabled: true, apiKeys: 5, sessions: 0, permissions: ['api-access'] },
  { id: '6', name: 'Emily Johnson', email: 'emily@nexus.ai', role: 'viewer', status: 'inactive', avatar: 'EJ', lastActive: '3d ago', createdAt: '2024-02-20', mfaEnabled: false, apiKeys: 0, sessions: 0, permissions: ['read'] },
  { id: '7', name: 'Robert Lee', email: 'robert@nexus.ai', role: 'editor', status: 'suspended', avatar: 'RL', lastActive: '7d ago', createdAt: '2024-03-01', mfaEnabled: false, apiKeys: 1, sessions: 0, permissions: ['read', 'write'] },
  { id: '8', name: 'Lisa Wang', email: 'lisa@nexus.ai', role: 'admin', status: 'active', avatar: 'LW', lastActive: '1m ago', createdAt: '2024-01-10', mfaEnabled: true, apiKeys: 4, sessions: 2, permissions: ['all'] },
  { id: '9', name: 'Bot Service Account', email: 'bot@nexus.ai', role: 'api', status: 'active', avatar: 'BS', lastActive: '10s ago', createdAt: '2024-03-01', mfaEnabled: false, apiKeys: 8, sessions: 0, permissions: ['api-access', 'webhooks'] },
  { id: '10', name: 'New User Invite', email: 'pending@example.com', role: 'viewer', status: 'pending', avatar: '??', lastActive: 'Never', createdAt: '2024-03-20', mfaEnabled: false, apiKeys: 0, sessions: 0, permissions: [] },
];

export default function UserManagement() {
  const [users] = useState(sampleUsers);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const filtered = useMemo(() => {
    let f = users;
    if (roleFilter !== 'All') f = f.filter(u => u.role === roleFilter);
    if (statusFilter !== 'All') f = f.filter(u => u.status === statusFilter);
    if (searchQuery) f = f.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase()));
    return f;
  }, [users, roleFilter, statusFilter, searchQuery]);

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    admins: users.filter(u => u.role === 'admin').length,
    mfa: users.filter(u => u.mfaEnabled).length,
  }), [users]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen bg-nexus-bg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold gradient-text flex items-center gap-3"><Users className="text-nexus-primary" /> User Management</h1>
          <p className="text-sm text-nexus-muted mt-1">{stats.total} users · {stats.active} active · {stats.mfa} MFA enabled</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 text-xs rounded-xl bg-nexus-primary text-white flex items-center gap-2"><UserPlus size={14} /> Invite User</button>
          <button className="px-4 py-2 text-xs rounded-xl bg-nexus-surface text-nexus-muted flex items-center gap-2"><Download size={14} /> Export</button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Users', value: stats.total, icon: <Users size={18} />, color: '#6366F1' },
          { label: 'Active Now', value: stats.active, icon: <Activity size={18} />, color: '#10B981' },
          { label: 'Administrators', value: stats.admins, icon: <Crown size={18} />, color: '#F59E0B' },
          { label: 'MFA Enabled', value: `${Math.round(stats.mfa / stats.total * 100)}%`, icon: <Shield size={18} />, color: '#3B82F6' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass rounded-2xl border border-nexus-border/30 p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${s.color}15` }}><span style={{ color: s.color }}>{s.icon}</span></div>
            <div>
              <p className="text-xl font-bold text-nexus-text">{s.value}</p>
              <p className="text-[10px] text-nexus-muted">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search users..." className="w-full pl-9 pr-3 py-2 bg-nexus-surface border border-nexus-border/20 rounded-xl text-sm text-nexus-text" />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="px-3 py-2 bg-nexus-surface border border-nexus-border/20 rounded-xl text-xs text-nexus-text">
          <option value="All">All Roles</option>
          {Object.keys(roleConfig).map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-nexus-surface border border-nexus-border/20 rounded-xl text-xs text-nexus-text">
          <option value="All">All Status</option>
          {Object.keys(statusConfig).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* User Table */}
      <div className="glass rounded-2xl border border-nexus-border/30 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-nexus-border/20 bg-nexus-surface/30">
              {['User', 'Role', 'Status', 'MFA', 'Last Active', 'API Keys', 'Sessions', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-nexus-muted uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, i) => {
              const rc = roleConfig[u.role];
              const sc = statusConfig[u.status];
              return (
                <motion.tr
                  key={u.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => setSelectedUser(selectedUser?.id === u.id ? null : u)}
                  className="border-b border-nexus-border/10 hover:bg-nexus-surface/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-nexus-primary/10 flex items-center justify-center text-xs font-bold text-nexus-primary">{u.avatar}</div>
                      <div>
                        <p className="text-sm font-medium text-nexus-text">{u.name}</p>
                        <p className="text-[10px] text-nexus-muted">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 text-[10px] rounded-full flex items-center gap-1 w-fit ${rc.bg} ${rc.color}`}>{rc.icon} {u.role}</span></td>
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full" style={{ backgroundColor: sc.dot }} /><span className={`text-xs ${sc.color}`}>{u.status}</span></div></td>
                  <td className="px-4 py-3">{u.mfaEnabled ? <Shield size={14} className="text-green-400" /> : <Unlock size={14} className="text-nexus-muted/30" />}</td>
                  <td className="px-4 py-3 text-xs text-nexus-muted">{u.lastActive}</td>
                  <td className="px-4 py-3 text-xs text-nexus-text">{u.apiKeys}</td>
                  <td className="px-4 py-3 text-xs text-nexus-text">{u.sessions}</td>
                  <td className="px-4 py-3"><MoreHorizontal size={14} className="text-nexus-muted" /></td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail Panel */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed bottom-6 right-6 w-96 glass rounded-2xl border border-nexus-border/30 p-6 shadow-2xl z-50">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-nexus-primary/10 flex items-center justify-center text-lg font-bold text-nexus-primary">{selectedUser.avatar}</div>
                <div>
                  <h3 className="font-semibold text-nexus-text">{selectedUser.name}</h3>
                  <p className="text-xs text-nexus-muted">{selectedUser.email}</p>
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} className="p-1 rounded-lg hover:bg-nexus-surface"><X size={14} className="text-nexus-muted" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-nexus-surface/50 rounded-lg p-3"><p className="text-[10px] text-nexus-muted">Role</p><p className={`text-sm font-medium ${roleConfig[selectedUser.role].color}`}>{selectedUser.role}</p></div>
              <div className="bg-nexus-surface/50 rounded-lg p-3"><p className="text-[10px] text-nexus-muted">Status</p><p className={`text-sm font-medium ${statusConfig[selectedUser.status].color}`}>{selectedUser.status}</p></div>
              <div className="bg-nexus-surface/50 rounded-lg p-3"><p className="text-[10px] text-nexus-muted">MFA</p><p className="text-sm text-nexus-text">{selectedUser.mfaEnabled ? 'Enabled' : 'Disabled'}</p></div>
              <div className="bg-nexus-surface/50 rounded-lg p-3"><p className="text-[10px] text-nexus-muted">Created</p><p className="text-sm text-nexus-text">{selectedUser.createdAt}</p></div>
            </div>
            <div className="mb-4">
              <p className="text-[10px] text-nexus-muted mb-2">Permissions</p>
              <div className="flex gap-1 flex-wrap">
                {selectedUser.permissions.map(p => (
                  <span key={p} className="px-2 py-0.5 text-[10px] bg-nexus-primary/10 text-nexus-primary rounded-full">{p}</span>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 px-3 py-2 text-xs rounded-xl bg-nexus-surface text-nexus-text hover:bg-nexus-surface/80"><Edit3 size={12} className="inline mr-1" /> Edit</button>
              <button className="flex-1 px-3 py-2 text-xs rounded-xl bg-nexus-surface text-nexus-text hover:bg-nexus-surface/80"><Key size={12} className="inline mr-1" /> Reset</button>
              <button className="px-3 py-2 text-xs rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20"><UserMinus size={12} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
