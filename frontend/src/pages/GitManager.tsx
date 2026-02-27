import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch, GitCommit, GitPullRequest, GitMerge, Tag, Search,
  RefreshCw, Plus, ChevronRight, ChevronDown, Clock, User, FileCode,
  Check, X, AlertCircle, Play, Square, Loader, Eye, Copy, ExternalLink,
  Filter, ArrowUpRight, ArrowDownLeft, MoreVertical, Trash2, Edit
} from 'lucide-react';
import { useIsDemoAccount } from '@/hooks/useDemoData';

interface Repository { id: string; name: string; provider: string; default_branch: string; branches_count: number; commits_count: number; open_prs: number; last_push: string; }
interface Commit { id: string; sha: string; message: string; author: string; date: string; additions: number; deletions: number; files_changed: number; }
interface Branch { id: string; name: string; is_default: boolean; ahead: number; behind: number; last_commit_date: string; protected: boolean; }
interface PullRequest { id: string; title: string; number: number; status: string; author: string; source_branch: string; target_branch: string; created_at: string; comments: number; additions: number; deletions: number; }
interface Pipeline { id: string; name: string; status: string; branch: string; commit_sha: string; duration_seconds: number; started_at: string; }

type TabType = 'repos' | 'commits' | 'branches' | 'prs' | 'pipelines' | 'tags';

const statusColors: Record<string, string> = {
  open: 'bg-green-500/20 text-green-400',
  closed: 'bg-red-500/20 text-red-400',
  merged: 'bg-purple-500/20 text-purple-400',
  draft: 'bg-gray-500/20 text-gray-400',
  success: 'bg-green-500/20 text-green-400',
  failed: 'bg-red-500/20 text-red-400',
  running: 'bg-blue-500/20 text-blue-400',
  pending: 'bg-yellow-500/20 text-yellow-400',
  cancelled: 'bg-gray-500/20 text-gray-400',
};

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.04 } } };
const itemVariants = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } } };

export default function GitManager() {
  const isDemo = useIsDemoAccount();
  const [activeTab, setActiveTab] = useState<TabType>('repos');
  const [repos, setRepos] = useState<Repository[]>([]);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedCommit, setExpandedCommit] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setRepos([
        { id: 'repo-1', name: 'nexus-ai/core', provider: 'github', default_branch: 'main', branches_count: 12, commits_count: 847, open_prs: 5, last_push: '2025-01-15T10:30:00Z' },
        { id: 'repo-2', name: 'nexus-ai/frontend', provider: 'github', default_branch: 'main', branches_count: 8, commits_count: 634, open_prs: 3, last_push: '2025-01-15T09:15:00Z' },
        { id: 'repo-3', name: 'nexus-ai/ml-models', provider: 'github', default_branch: 'main', branches_count: 6, commits_count: 215, open_prs: 2, last_push: '2025-01-14T18:00:00Z' },
        { id: 'repo-4', name: 'nexus-ai/infra', provider: 'github', default_branch: 'main', branches_count: 4, commits_count: 128, open_prs: 1, last_push: '2025-01-14T16:45:00Z' },
      ]);
      setCommits([
        { id: 'c1', sha: 'a1b2c3d4', message: 'feat: implement real-time collaboration engine', author: 'sarah.chen', date: '2025-01-15T10:30:00Z', additions: 342, deletions: 56, files_changed: 12 },
        { id: 'c2', sha: 'e5f6g7h8', message: 'fix: resolve WebSocket reconnection race condition', author: 'marcus.dev', date: '2025-01-15T09:15:00Z', additions: 28, deletions: 14, files_changed: 3 },
        { id: 'c3', sha: 'i9j0k1l2', message: 'refactor: optimize database query performance', author: 'anna.sql', date: '2025-01-15T08:45:00Z', additions: 156, deletions: 213, files_changed: 8 },
        { id: 'c4', sha: 'm3n4o5p6', message: 'docs: update API documentation for v2.0', author: 'tech.writer', date: '2025-01-14T18:00:00Z', additions: 445, deletions: 32, files_changed: 15 },
        { id: 'c5', sha: 'q7r8s9t0', message: 'test: add integration tests for auth service', author: 'qa.lead', date: '2025-01-14T16:30:00Z', additions: 678, deletions: 12, files_changed: 22 },
        { id: 'c6', sha: 'u1v2w3x4', message: 'perf: reduce bundle size by 40% with tree shaking', author: 'sarah.chen', date: '2025-01-14T15:00:00Z', additions: 45, deletions: 890, files_changed: 6 },
        { id: 'c7', sha: 'y5z6a7b8', message: 'feat: add dark mode support across all components', author: 'ui.designer', date: '2025-01-14T14:15:00Z', additions: 234, deletions: 67, files_changed: 18 },
        { id: 'c8', sha: 'c9d0e1f2', message: 'ci: configure parallel test execution', author: 'devops.eng', date: '2025-01-14T12:00:00Z', additions: 89, deletions: 23, files_changed: 4 },
      ]);
      setBranches([
        { id: 'b1', name: 'main', is_default: true, ahead: 0, behind: 0, last_commit_date: '2025-01-15T10:30:00Z', protected: true },
        { id: 'b2', name: 'develop', is_default: false, ahead: 12, behind: 0, last_commit_date: '2025-01-15T09:15:00Z', protected: true },
        { id: 'b3', name: 'feature/collaboration', is_default: false, ahead: 5, behind: 2, last_commit_date: '2025-01-15T08:45:00Z', protected: false },
        { id: 'b4', name: 'feature/dark-mode', is_default: false, ahead: 3, behind: 8, last_commit_date: '2025-01-14T14:15:00Z', protected: false },
        { id: 'b5', name: 'hotfix/auth-fix', is_default: false, ahead: 1, behind: 0, last_commit_date: '2025-01-14T16:30:00Z', protected: false },
        { id: 'b6', name: 'release/v2.0', is_default: false, ahead: 0, behind: 3, last_commit_date: '2025-01-13T12:00:00Z', protected: true },
      ]);
      setPullRequests([
        { id: 'pr1', title: 'Implement real-time collaboration engine', number: 142, status: 'open', author: 'sarah.chen', source_branch: 'feature/collaboration', target_branch: 'develop', created_at: '2025-01-14T10:00:00Z', comments: 8, additions: 342, deletions: 56 },
        { id: 'pr2', title: 'Add comprehensive dark mode support', number: 141, status: 'open', author: 'ui.designer', source_branch: 'feature/dark-mode', target_branch: 'develop', created_at: '2025-01-13T15:00:00Z', comments: 12, additions: 234, deletions: 67 },
        { id: 'pr3', title: 'Fix WebSocket reconnection issues', number: 140, status: 'merged', author: 'marcus.dev', source_branch: 'hotfix/auth-fix', target_branch: 'main', created_at: '2025-01-14T09:00:00Z', comments: 4, additions: 28, deletions: 14 },
        { id: 'pr4', title: 'Optimize database query performance', number: 139, status: 'merged', author: 'anna.sql', source_branch: 'feature/db-perf', target_branch: 'develop', created_at: '2025-01-12T14:00:00Z', comments: 15, additions: 156, deletions: 213 },
        { id: 'pr5', title: 'Release v2.0 preparation', number: 138, status: 'draft', author: 'tech.lead', source_branch: 'release/v2.0', target_branch: 'main', created_at: '2025-01-13T10:00:00Z', comments: 3, additions: 12, deletions: 5 },
      ]);
      setPipelines([
        { id: 'pip1', name: 'CI/CD Pipeline', status: 'success', branch: 'main', commit_sha: 'a1b2c3d4', duration_seconds: 342, started_at: '2025-01-15T10:35:00Z' },
        { id: 'pip2', name: 'CI/CD Pipeline', status: 'running', branch: 'feature/collaboration', commit_sha: 'i9j0k1l2', duration_seconds: 180, started_at: '2025-01-15T09:20:00Z' },
        { id: 'pip3', name: 'CI/CD Pipeline', status: 'failed', branch: 'feature/dark-mode', commit_sha: 'y5z6a7b8', duration_seconds: 123, started_at: '2025-01-14T14:20:00Z' },
        { id: 'pip4', name: 'Deploy Production', status: 'success', branch: 'main', commit_sha: 'e5f6g7h8', duration_seconds: 567, started_at: '2025-01-14T16:00:00Z' },
      ]);
      setSelectedRepo('repo-1');
      setLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const tabs: { key: TabType; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'repos', label: 'Repositories', icon: <FileCode className="w-4 h-4" />, count: repos.length },
    { key: 'commits', label: 'Commits', icon: <GitCommit className="w-4 h-4" />, count: commits.length },
    { key: 'branches', label: 'Branches', icon: <GitBranch className="w-4 h-4" />, count: branches.length },
    { key: 'prs', label: 'Pull Requests', icon: <GitPullRequest className="w-4 h-4" />, count: pullRequests.length },
    { key: 'pipelines', label: 'Pipelines', icon: <Play className="w-4 h-4" />, count: pipelines.length },
    { key: 'tags', label: 'Tags', icon: <Tag className="w-4 h-4" />, count: 4 },
  ];

  const filteredCommits = useMemo(() => commits.filter(c =>
    c.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.sha.includes(searchQuery)
  ), [commits, searchQuery]);

  const filteredPRs = useMemo(() => pullRequests.filter(pr =>
    pr.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pr.author.toLowerCase().includes(searchQuery.toLowerCase())
  ), [pullRequests, searchQuery]);

  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return days === 1 ? '1 day ago' : `${days} days ago`;
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div whileHover={{ rotate: 360 }} transition={{ duration: 0.5 }} className="p-3 bg-purple-500/20 rounded-xl">
              <GitBranch className="w-7 h-7 text-purple-400" />
            </motion.div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Git Manager</h1>
              <p className="text-gray-400 text-sm">Repository management & version control</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500 w-64 transition-colors" />
            </div>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
              <Plus className="w-4 h-4" /> New Repository
            </motion.button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-800/30 rounded-xl p-1 border border-gray-700/50">
          {tabs.map(tab => (
            <motion.button key={tab.key} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'}`}>
              {tab.icon}
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeTab === tab.key ? 'bg-purple-500/50' : 'bg-gray-700/50'}`}>{tab.count}</span>
            </motion.button>
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {/* Repositories Tab */}
          {activeTab === 'repos' && (
            <motion.div key="repos" variants={containerVariants} initial="hidden" animate="visible" exit="hidden" className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {repos.map(repo => (
                <motion.div key={repo.id} variants={itemVariants} whileHover={{ scale: 1.01 }} onClick={() => setSelectedRepo(repo.id)}
                  className={`p-5 rounded-xl border cursor-pointer transition-all ${selectedRepo === repo.id ? 'bg-purple-500/10 border-purple-500/50' : 'bg-gray-800/30 border-gray-700/50 hover:border-gray-600'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-700/50 rounded-lg"><FileCode className="w-5 h-5 text-purple-400" /></div>
                      <div>
                        <h3 className="font-semibold text-white">{repo.name}</h3>
                        <p className="text-xs text-gray-500">{repo.provider} · {repo.default_branch}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">{formatDate(repo.last_push)}</span>
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1.5 text-gray-400"><GitBranch className="w-3.5 h-3.5" /> {repo.branches_count} branches</span>
                    <span className="flex items-center gap-1.5 text-gray-400"><GitCommit className="w-3.5 h-3.5" /> {repo.commits_count} commits</span>
                    <span className="flex items-center gap-1.5 text-green-400"><GitPullRequest className="w-3.5 h-3.5" /> {repo.open_prs} open PRs</span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Commits Tab */}
          {activeTab === 'commits' && (
            <motion.div key="commits" variants={containerVariants} initial="hidden" animate="visible" exit="hidden" className="space-y-2">
              {filteredCommits.map(commit => (
                <motion.div key={commit.id} variants={itemVariants} className="bg-gray-800/30 border border-gray-700/50 rounded-xl overflow-hidden">
                  <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-800/50 transition-colors" onClick={() => setExpandedCommit(expandedCommit === commit.id ? null : commit.id)}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-1.5 bg-blue-500/20 rounded-lg"><GitCommit className="w-4 h-4 text-blue-400" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{commit.message}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><User className="w-3 h-3" /> {commit.author}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDate(commit.date)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <code className="text-xs bg-gray-700/50 px-2 py-1 rounded font-mono text-purple-300">{commit.sha}</code>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-green-400">+{commit.additions}</span>
                        <span className="text-red-400">-{commit.deletions}</span>
                      </div>
                      <motion.div animate={{ rotate: expandedCommit === commit.id ? 90 : 0 }}><ChevronRight className="w-4 h-4 text-gray-500" /></motion.div>
                    </div>
                  </div>
                  <AnimatePresence>
                    {expandedCommit === commit.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-gray-700/50 px-4 py-3 bg-gray-900/50">
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                          <span>{commit.files_changed} files changed</span>
                          <span className="text-green-400">{commit.additions} insertions(+)</span>
                          <span className="text-red-400">{commit.deletions} deletions(-)</span>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <button className="px-3 py-1 bg-gray-700/50 rounded text-xs text-gray-300 hover:bg-gray-600/50 flex items-center gap-1"><Eye className="w-3 h-3" /> View diff</button>
                          <button className="px-3 py-1 bg-gray-700/50 rounded text-xs text-gray-300 hover:bg-gray-600/50 flex items-center gap-1"><Copy className="w-3 h-3" /> Copy SHA</button>
                          <button className="px-3 py-1 bg-gray-700/50 rounded text-xs text-gray-300 hover:bg-gray-600/50 flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Browse files</button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Branches Tab */}
          {activeTab === 'branches' && (
            <motion.div key="branches" variants={containerVariants} initial="hidden" animate="visible" exit="hidden" className="space-y-2">
              {branches.map(branch => (
                <motion.div key={branch.id} variants={itemVariants} className="p-4 bg-gray-800/30 border border-gray-700/50 rounded-xl flex items-center justify-between hover:bg-gray-800/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${branch.is_default ? 'bg-green-500/20' : 'bg-gray-700/50'}`}>
                      <GitBranch className={`w-4 h-4 ${branch.is_default ? 'text-green-400' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white text-sm">{branch.name}</span>
                        {branch.is_default && <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">default</span>}
                        {branch.protected && <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">protected</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{formatDate(branch.last_commit_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {(branch.ahead > 0 || branch.behind > 0) && (
                      <div className="flex items-center gap-2 text-xs">
                        {branch.ahead > 0 && <span className="flex items-center gap-1 text-green-400"><ArrowUpRight className="w-3 h-3" /> {branch.ahead} ahead</span>}
                        {branch.behind > 0 && <span className="flex items-center gap-1 text-orange-400"><ArrowDownLeft className="w-3 h-3" /> {branch.behind} behind</span>}
                      </div>
                    )}
                    {!branch.is_default && (
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="px-3 py-1.5 bg-purple-600/50 hover:bg-purple-600 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition-colors">
                        <GitMerge className="w-3 h-3" /> Merge
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Pull Requests Tab */}
          {activeTab === 'prs' && (
            <motion.div key="prs" variants={containerVariants} initial="hidden" animate="visible" exit="hidden" className="space-y-3">
              {filteredPRs.map(pr => (
                <motion.div key={pr.id} variants={itemVariants} className="p-5 bg-gray-800/30 border border-gray-700/50 rounded-xl hover:border-gray-600 transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-1.5 rounded-lg mt-0.5 ${pr.status === 'merged' ? 'bg-purple-500/20' : pr.status === 'open' ? 'bg-green-500/20' : 'bg-gray-700/50'}`}>
                        {pr.status === 'merged' ? <GitMerge className="w-4 h-4 text-purple-400" /> : <GitPullRequest className={`w-4 h-4 ${pr.status === 'open' ? 'text-green-400' : 'text-gray-400'}`} />}
                      </div>
                      <div>
                        <h3 className="font-medium text-white text-sm">{pr.title}</h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span>#{pr.number}</span>
                          <span className="flex items-center gap-1"><User className="w-3 h-3" /> {pr.author}</span>
                          <span>{formatDate(pr.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-xs">
                          <code className="bg-gray-700/50 px-2 py-0.5 rounded font-mono text-blue-300">{pr.source_branch}</code>
                          <ChevronRight className="w-3 h-3 text-gray-500" />
                          <code className="bg-gray-700/50 px-2 py-0.5 rounded font-mono text-green-300">{pr.target_branch}</code>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[pr.status] || 'bg-gray-700 text-gray-400'}`}>{pr.status}</span>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="text-green-400">+{pr.additions}</span>
                        <span className="text-red-400">-{pr.deletions}</span>
                        <span>💬 {pr.comments}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Pipelines Tab */}
          {activeTab === 'pipelines' && (
            <motion.div key="pipelines" variants={containerVariants} initial="hidden" animate="visible" exit="hidden" className="space-y-2">
              {pipelines.map(pip => (
                <motion.div key={pip.id} variants={itemVariants} className="p-4 bg-gray-800/30 border border-gray-700/50 rounded-xl flex items-center justify-between hover:bg-gray-800/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${pip.status === 'success' ? 'bg-green-500/20' : pip.status === 'failed' ? 'bg-red-500/20' : pip.status === 'running' ? 'bg-blue-500/20' : 'bg-gray-700/50'}`}>
                      {pip.status === 'success' ? <Check className="w-4 h-4 text-green-400" /> : pip.status === 'failed' ? <X className="w-4 h-4 text-red-400" /> : pip.status === 'running' ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}><Loader className="w-4 h-4 text-blue-400" /></motion.div> : <AlertCircle className="w-4 h-4 text-gray-400" />}
                    </div>
                    <div>
                      <p className="font-medium text-white text-sm">{pip.name}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><GitBranch className="w-3 h-3" /> {pip.branch}</span>
                        <code className="font-mono text-purple-300">{pip.commit_sha.slice(0, 8)}</code>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[pip.status] || 'bg-gray-700 text-gray-400'}`}>{pip.status}</span>
                    <span className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDuration(pip.duration_seconds)}</span>
                    {pip.status === 'running' && (
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="p-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors"><Square className="w-3.5 h-3.5 text-red-400" /></motion.button>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Tags Tab */}
          {activeTab === 'tags' && (
            <motion.div key="tags" variants={containerVariants} initial="hidden" animate="visible" exit="hidden" className="space-y-2">
              {[
                { name: 'v2.0.0-beta.1', date: '2025-01-15', message: 'Beta release with collaboration features', sha: 'a1b2c3d4' },
                { name: 'v1.9.2', date: '2025-01-10', message: 'Patch release: security fixes', sha: 'x9y0z1a2' },
                { name: 'v1.9.1', date: '2025-01-05', message: 'Patch: WebSocket stability improvements', sha: 'b3c4d5e6' },
                { name: 'v1.9.0', date: '2024-12-20', message: 'Minor release: analytics dashboard v2', sha: 'f7g8h9i0' },
              ].map((tag, i) => (
                <motion.div key={tag.name} variants={itemVariants} className="p-4 bg-gray-800/30 border border-gray-700/50 rounded-xl flex items-center justify-between hover:bg-gray-800/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-yellow-500/20 rounded-lg"><Tag className="w-4 h-4 text-yellow-400" /></div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white text-sm">{tag.name}</span>
                        {i === 0 && <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">latest</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{tag.message}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <code className="font-mono text-purple-300 bg-gray-700/50 px-2 py-0.5 rounded">{tag.sha}</code>
                    <span>{tag.date}</span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
