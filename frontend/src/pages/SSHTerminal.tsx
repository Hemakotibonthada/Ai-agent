import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal, Plus, X, Server, Wifi, WifiOff, Upload, Download,
  Folder, FileText, Settings, Shield, Clock, Loader, ChevronRight,
  Copy, Maximize2, Minimize2, RefreshCw, Trash2, Search, Key
} from 'lucide-react';

interface SSHConnection {
  id: string; name: string; host: string; port: number; username: string;
  status: 'connected' | 'disconnected' | 'connecting'; lastConnected: string;
  group: string;
}

interface TerminalLine { text: string; type: 'input' | 'output' | 'error' | 'system'; timestamp: string; }

export default function SSHTerminal() {
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<SSHConnection[]>([]);
  const [activeConnection, setActiveConnection] = useState<SSHConnection | null>(null);
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [command, setCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showNewConnection, setShowNewConnection] = useState(false);
  const [newConn, setNewConn] = useState({ name: '', host: '', port: '22', username: 'root' });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'terminal' | 'sftp' | 'keys'>('terminal');
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => {
      setConnections([
        { id: 's1', name: 'Production Server', host: '10.0.1.100', port: 22, username: 'deploy', status: 'connected', lastConnected: '2 min ago', group: 'Production' },
        { id: 's2', name: 'Staging Server', host: '10.0.2.50', port: 22, username: 'admin', status: 'connected', lastConnected: '15 min ago', group: 'Staging' },
        { id: 's3', name: 'Dev Database', host: '10.0.3.20', port: 5432, username: 'postgres', status: 'disconnected', lastConnected: '1 hour ago', group: 'Development' },
        { id: 's4', name: 'ML GPU Server', host: '10.0.4.10', port: 22, username: 'ml-user', status: 'disconnected', lastConnected: '3 hours ago', group: 'AI/ML' },
        { id: 's5', name: 'CI/CD Runner', host: '10.0.5.5', port: 22, username: 'runner', status: 'connected', lastConnected: 'Just now', group: 'DevOps' },
        { id: 's6', name: 'Monitoring Node', host: '10.0.6.15', port: 22, username: 'monitor', status: 'disconnected', lastConnected: '2 days ago', group: 'DevOps' },
      ]);
      setLoading(false);
    }, 400);
  }, []);

  const connectToServer = (conn: SSHConnection) => {
    setActiveConnection(conn);
    const now = new Date().toLocaleTimeString();
    setTerminalLines([
      { text: `Connecting to ${conn.username}@${conn.host}:${conn.port}...`, type: 'system', timestamp: now },
      { text: `Connected. OpenSSH_9.6, LibreSSL 3.8.2`, type: 'system', timestamp: now },
      { text: `Last login: ${new Date().toUTCString()} from 10.0.0.1`, type: 'system', timestamp: now },
      { text: `Welcome to NexusAI Server (${conn.name})`, type: 'system', timestamp: now },
      { text: `${conn.username}@${conn.name.replace(/\s/g, '-').toLowerCase()}:~$`, type: 'output', timestamp: now },
    ]);
    setConnections(prev => prev.map(c => c.id === conn.id ? { ...c, status: 'connected' as const } : c));
  };

  const executeCommand = () => {
    if (!command.trim() || !activeConnection) return;
    const now = new Date().toLocaleTimeString();
    const newLines: TerminalLine[] = [{ text: `${activeConnection.username}@host:~$ ${command}`, type: 'input', timestamp: now }];

    const cmd = command.trim().toLowerCase();
    if (cmd === 'ls' || cmd === 'ls -la') {
      newLines.push({ text: 'total 128\ndrwxr-xr-x  15 root root  4096 Jan 15 10:30 .\ndrwxr-xr-x   3 root root  4096 Jan 10 08:15 ..\ndrwxr-xr-x   2 root root  4096 Jan 14 22:00 backend\ndrwxr-xr-x   5 root root  4096 Jan 14 22:00 frontend\n-rw-r--r--   1 root root  2048 Jan 15 10:30 docker-compose.yml\n-rw-r--r--   1 root root   512 Jan 12 15:20 .env\ndrwxr-xr-x   2 root root  4096 Jan 13 09:00 logs\ndrwxr-xr-x   3 root root  4096 Jan 11 14:30 models', type: 'output', timestamp: now });
    } else if (cmd === 'pwd') {
      newLines.push({ text: '/home/' + activeConnection.username, type: 'output', timestamp: now });
    } else if (cmd === 'whoami') {
      newLines.push({ text: activeConnection.username, type: 'output', timestamp: now });
    } else if (cmd === 'uname -a') {
      newLines.push({ text: 'Linux nexus-server 6.5.0-14-generic #14-Ubuntu SMP x86_64 GNU/Linux', type: 'output', timestamp: now });
    } else if (cmd.startsWith('cat ')) {
      newLines.push({ text: '# Configuration loaded from environment\nDATABASE_URL=postgresql://localhost:5432/nexus\nREDIS_URL=redis://localhost:6379\nAI_MODEL_PATH=/models/nexus-v2\nLOG_LEVEL=info', type: 'output', timestamp: now });
    } else if (cmd === 'top' || cmd === 'htop') {
      newLines.push({ text: 'PID  USER     %CPU %MEM  COMMAND\n  1  root      0.0  0.1  systemd\n 42  deploy   18.5  5.2  python3 main.py\n 78  deploy    8.7  3.1  node server.js\n112  postgres  4.2  8.5  postgres\n156  redis     1.8  0.8  redis-server\nLoad average: 0.85, 0.72, 0.68', type: 'output', timestamp: now });
    } else if (cmd === 'df -h') {
      newLines.push({ text: 'Filesystem      Size  Used Avail Use% Mounted on\n/dev/sda1       500G  312G  188G  63% /\n/dev/sdb1       2.0T  1.2T  800G  62% /data\ntmpfs            16G  2.1G   14G  13% /dev/shm', type: 'output', timestamp: now });
    } else if (cmd === 'free -h') {
      newLines.push({ text: '              total        used        free      shared  buff/cache   available\nMem:            32G        12G        8.5G        1.2G        11G        18G\nSwap:          8.0G        512M        7.5G', type: 'output', timestamp: now });
    } else if (cmd === 'clear') {
      setTerminalLines([]);
      setCommand('');
      setCommandHistory(prev => [...prev, command]);
      return;
    } else if (cmd === 'exit') {
      newLines.push({ text: 'Connection closed.', type: 'system', timestamp: now });
      setActiveConnection(null);
    } else {
      newLines.push({ text: `${cmd}: command executed successfully`, type: 'output', timestamp: now });
    }

    setTerminalLines(prev => [...prev, ...newLines]);
    setCommandHistory(prev => [...prev, command]);
    setHistoryIndex(-1);
    setCommand('');
    setTimeout(() => terminalRef.current?.scrollTo({ top: terminalRef.current.scrollHeight, behavior: 'smooth' }), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { executeCommand(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (commandHistory.length > 0) { const idx = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex; setHistoryIndex(idx); setCommand(commandHistory[commandHistory.length - 1 - idx]); } }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (historyIndex > 0) { const idx = historyIndex - 1; setHistoryIndex(idx); setCommand(commandHistory[commandHistory.length - 1 - idx]); } else { setHistoryIndex(-1); setCommand(''); } }
  };

  const sftpFiles = [
    { name: 'backend/', type: 'dir', size: '-', modified: 'Jan 15 10:30', perms: 'drwxr-xr-x' },
    { name: 'frontend/', type: 'dir', size: '-', modified: 'Jan 14 22:00', perms: 'drwxr-xr-x' },
    { name: 'docker-compose.yml', type: 'file', size: '2.0 KB', modified: 'Jan 15 10:30', perms: '-rw-r--r--' },
    { name: '.env', type: 'file', size: '512 B', modified: 'Jan 12 15:20', perms: '-rw-------' },
    { name: 'logs/', type: 'dir', size: '-', modified: 'Jan 13 09:00', perms: 'drwxr-xr-x' },
    { name: 'README.md', type: 'file', size: '8.4 KB', modified: 'Jan 10 08:15', perms: '-rw-r--r--' },
  ];

  const sshKeys = [
    { name: 'Production Deploy Key', type: 'ed25519', fingerprint: 'SHA256:8Kj...dPq', created: '2024-01-05', lastUsed: '2 min ago' },
    { name: 'Personal Key', type: 'rsa-4096', fingerprint: 'SHA256:xM2...rTf', created: '2023-11-20', lastUsed: '1 hour ago' },
    { name: 'CI/CD Runner Key', type: 'ed25519', fingerprint: 'SHA256:nQ7...sLm', created: '2024-01-10', lastUsed: 'Just now' },
  ];

  const filteredConns = connections.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.host.includes(search));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
          <Loader className="w-8 h-8 text-emerald-500" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-emerald-950/20 to-gray-950 p-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="p-3 bg-emerald-500/20 rounded-xl">
              <Terminal className="w-7 h-7 text-emerald-400" />
            </motion.div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">SSH Terminal</h1>
              <p className="text-gray-400 text-sm">Secure shell connection manager</p>
            </div>
          </div>
          <div className="flex gap-2">
            {(['terminal', 'sftp', 'keys'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${view === v ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-gray-500 hover:text-gray-300'}`}>
                {v === 'terminal' ? 'Terminal' : v === 'sftp' ? 'SFTP' : 'SSH Keys'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          {/* Server List */}
          <div className="w-64 bg-gray-800/30 border border-gray-700/50 rounded-xl p-3 shrink-0 space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search servers..."
                className="w-full pl-8 pr-3 py-1.5 bg-gray-700/50 border border-gray-600 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none" />
            </div>
            <button onClick={() => setShowNewConnection(true)} className="w-full flex items-center gap-1.5 px-3 py-2 bg-emerald-600/30 text-emerald-300 text-xs rounded-lg hover:bg-emerald-600/40 transition-colors">
              <Plus className="w-3.5 h-3.5" /> New Connection
            </button>
            <div className="space-y-1.5">
              {filteredConns.map(conn => (
                <motion.button key={conn.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  onClick={() => connectToServer(conn)}
                  className={`w-full text-left p-2.5 rounded-lg transition-all ${activeConnection?.id === conn.id ? 'bg-emerald-500/15 border border-emerald-500/30' : 'bg-gray-700/20 border border-transparent hover:bg-gray-700/40'}`}>
                  <div className="flex items-center gap-2">
                    {conn.status === 'connected' ? <Wifi className="w-3.5 h-3.5 text-green-400" /> : <WifiOff className="w-3.5 h-3.5 text-gray-500" />}
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-white font-medium block truncate">{conn.name}</span>
                      <span className="text-[10px] text-gray-500 font-mono">{conn.host}:{conn.port}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-gray-600">{conn.group}</span>
                    <span className="text-[10px] text-gray-600">{conn.lastConnected}</span>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <AnimatePresence mode="wait">
              {view === 'terminal' && (
                <motion.div key="terminal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className={`bg-gray-900 border border-gray-700/50 rounded-xl overflow-hidden ${isFullscreen ? 'fixed inset-4 z-50' : ''}`}>
                  {/* Terminal Header */}
                  <div className="px-4 py-2 bg-gray-800/80 border-b border-gray-700/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <div className="w-3 h-3 rounded-full bg-amber-500" />
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                      </div>
                      <span className="text-xs text-gray-400 ml-2">
                        {activeConnection ? `${activeConnection.username}@${activeConnection.host}` : 'No connection'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-1 text-gray-500 hover:text-gray-300">
                        {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  {/* Terminal Body */}
                  <div ref={terminalRef} className="p-4 h-[450px] overflow-y-auto font-mono text-sm space-y-0.5">
                    {!activeConnection ? (
                      <div className="h-full flex items-center justify-center text-gray-600">
                        <div className="text-center">
                          <Terminal className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>Select a server to connect</p>
                        </div>
                      </div>
                    ) : (
                      terminalLines.map((line, i) => (
                        <div key={i} className={`${line.type === 'input' ? 'text-green-400' : line.type === 'error' ? 'text-red-400' : line.type === 'system' ? 'text-cyan-400 italic' : 'text-gray-300'}`}>
                          <span className="whitespace-pre-wrap">{line.text}</span>
                        </div>
                      ))
                    )}
                  </div>
                  {/* Input */}
                  {activeConnection && (
                    <div className="px-4 py-2 border-t border-gray-700/50 flex items-center gap-2">
                      <span className="text-green-400 text-sm font-mono">{activeConnection.username}@host:~$</span>
                      <input value={command} onChange={e => setCommand(e.target.value)} onKeyDown={handleKeyDown}
                        autoFocus placeholder="Enter command..."
                        className="flex-1 bg-transparent text-white text-sm font-mono focus:outline-none placeholder-gray-600" />
                    </div>
                  )}
                </motion.div>
              )}

              {view === 'sftp' && (
                <motion.div key="sftp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="bg-gray-800/30 border border-gray-700/50 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-700/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Folder className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-medium text-white">SFTP File Browser</span>
                      <span className="text-xs text-gray-500 font-mono">/home/{activeConnection?.username || 'user'}/</span>
                    </div>
                    <div className="flex gap-2">
                      <button className="flex items-center gap-1 px-2 py-1 bg-blue-600/30 text-blue-300 text-xs rounded hover:bg-blue-600/40"><Upload className="w-3 h-3" /> Upload</button>
                      <button className="flex items-center gap-1 px-2 py-1 bg-green-600/30 text-green-300 text-xs rounded hover:bg-green-600/40"><Download className="w-3 h-3" /> Download</button>
                    </div>
                  </div>
                  <table className="w-full">
                    <thead><tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-700/30">
                      <th className="text-left p-3">Name</th><th className="text-left p-3">Permissions</th><th className="text-right p-3">Size</th><th className="text-right p-3">Modified</th>
                    </tr></thead>
                    <tbody>
                      {sftpFiles.map(f => (
                        <tr key={f.name} className="border-b border-gray-700/20 hover:bg-gray-800/40 cursor-pointer text-sm">
                          <td className="p-3 flex items-center gap-2">
                            {f.type === 'dir' ? <Folder className="w-4 h-4 text-amber-400" /> : <FileText className="w-4 h-4 text-gray-400" />}
                            <span className={f.type === 'dir' ? 'text-blue-400' : 'text-white'}>{f.name}</span>
                          </td>
                          <td className="p-3 text-gray-500 font-mono text-xs">{f.perms}</td>
                          <td className="p-3 text-right text-gray-400">{f.size}</td>
                          <td className="p-3 text-right text-xs text-gray-500">{f.modified}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </motion.div>
              )}

              {view === 'keys' && (
                <motion.div key="keys" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm text-gray-400">SSH Keys</h3>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors">
                      <Plus className="w-3.5 h-3.5" /> Generate Key
                    </button>
                  </div>
                  {sshKeys.map(key => (
                    <motion.div key={key.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-gray-800/30 border border-gray-700/50 rounded-xl flex items-center gap-4">
                      <div className="p-2.5 bg-emerald-500/15 rounded-lg"><Key className="w-5 h-5 text-emerald-400" /></div>
                      <div className="flex-1">
                        <h4 className="text-sm text-white font-medium">{key.name}</h4>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span className="font-mono">{key.type}</span>
                          <span className="font-mono">{key.fingerprint}</span>
                          <span>Created: {key.created}</span>
                          <span>Last used: {key.lastUsed}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button className="p-1.5 text-gray-500 hover:text-blue-400"><Copy className="w-4 h-4" /></button>
                        <button className="p-1.5 text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* New Connection Modal */}
        <AnimatePresence>
          {showNewConnection && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowNewConnection(false)}>
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-96" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-medium text-white mb-4">New SSH Connection</h3>
                <div className="space-y-3">
                  <div><label className="text-xs text-gray-500 block mb-1">Name</label>
                    <input value={newConn.name} onChange={e => setNewConn(p => ({ ...p, name: e.target.value }))} placeholder="My Server"
                      className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1"><label className="text-xs text-gray-500 block mb-1">Host</label>
                      <input value={newConn.host} onChange={e => setNewConn(p => ({ ...p, host: e.target.value }))} placeholder="192.168.1.1"
                        className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                    </div>
                    <div className="w-20"><label className="text-xs text-gray-500 block mb-1">Port</label>
                      <input value={newConn.port} onChange={e => setNewConn(p => ({ ...p, port: e.target.value }))} placeholder="22"
                        className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                    </div>
                  </div>
                  <div><label className="text-xs text-gray-500 block mb-1">Username</label>
                    <input value={newConn.username} onChange={e => setNewConn(p => ({ ...p, username: e.target.value }))} placeholder="root"
                      className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setShowNewConnection(false)} className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors">Cancel</button>
                    <button onClick={() => setShowNewConnection(false)} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors">Connect</button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
