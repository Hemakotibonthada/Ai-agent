import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen, File, FileText, Image, Video, Music, Code,
  Archive, Download, Upload, Plus, Search, Grid3X3, List,
  ChevronRight, MoreVertical, Trash2, Edit3, Copy, Move,
  Eye, Star, Clock, HardDrive, FolderPlus, X, ArrowUp,
  Home, Filter, SortAsc, FileJson, FileSpreadsheet,
  FileCode, FilePieChart
} from 'lucide-react';
import { FadeIn } from '../lib/animations';

interface FileItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
  mimeType?: string;
  size?: string;
  modified: string;
  icon: React.ReactNode;
  color: string;
  children?: FileItem[];
  starred?: boolean;
}

const getFileIcon = (name: string): { icon: React.ReactNode; color: string } => {
  const ext = name.split('.').pop()?.toLowerCase();
  const config: Record<string, { icon: React.ReactNode; color: string }> = {
    jpg: { icon: <Image size={18} />, color: 'text-pink-500' },
    png: { icon: <Image size={18} />, color: 'text-pink-500' },
    svg: { icon: <Image size={18} />, color: 'text-pink-500' },
    gif: { icon: <Image size={18} />, color: 'text-pink-500' },
    mp4: { icon: <Video size={18} />, color: 'text-purple-500' },
    mp3: { icon: <Music size={18} />, color: 'text-orange-500' },
    wav: { icon: <Music size={18} />, color: 'text-orange-500' },
    pdf: { icon: <FileText size={18} />, color: 'text-red-500' },
    doc: { icon: <FileText size={18} />, color: 'text-blue-500' },
    docx: { icon: <FileText size={18} />, color: 'text-blue-500' },
    xls: { icon: <FileSpreadsheet size={18} />, color: 'text-green-500' },
    xlsx: { icon: <FileSpreadsheet size={18} />, color: 'text-green-500' },
    csv: { icon: <FileSpreadsheet size={18} />, color: 'text-green-500' },
    json: { icon: <FileJson size={18} />, color: 'text-yellow-500' },
    py: { icon: <FileCode size={18} />, color: 'text-blue-500' },
    ts: { icon: <FileCode size={18} />, color: 'text-blue-600' },
    tsx: { icon: <FileCode size={18} />, color: 'text-cyan-500' },
    js: { icon: <FileCode size={18} />, color: 'text-yellow-500' },
    html: { icon: <Code size={18} />, color: 'text-orange-500' },
    css: { icon: <Code size={18} />, color: 'text-blue-400' },
    zip: { icon: <Archive size={18} />, color: 'text-amber-500' },
    tar: { icon: <Archive size={18} />, color: 'text-amber-500' },
    md: { icon: <FileText size={18} />, color: 'text-gray-500' },
    txt: { icon: <FileText size={18} />, color: 'text-gray-500' },
    log: { icon: <FileText size={18} />, color: 'text-gray-400' },
  };
  return config[ext || ''] || { icon: <File size={18} />, color: 'text-gray-400' };
};

const fileSystem: FileItem[] = [
  {
    id: 'f1', name: 'agents', type: 'folder', modified: '2 hours ago', icon: <FolderOpen size={18} />, color: 'text-blue-500',
    children: [
      { id: 'f1a', name: 'orchestrator.py', type: 'file', size: '12.4 KB', modified: '1 day ago', ...getFileIcon('orchestrator.py') },
      { id: 'f1b', name: 'personal_agent.py', type: 'file', size: '8.2 KB', modified: '2 days ago', ...getFileIcon('personal_agent.py') },
      { id: 'f1c', name: 'security_agent.py', type: 'file', size: '15.1 KB', modified: '3 days ago', ...getFileIcon('security_agent.py') },
      { id: 'f1d', name: 'health_agent.py', type: 'file', size: '9.7 KB', modified: '1 week ago', ...getFileIcon('health_agent.py') },
      { id: 'f1e', name: 'home_agent.py', type: 'file', size: '11.3 KB', modified: '5 days ago', ...getFileIcon('home_agent.py') },
      { id: 'f1f', name: 'voice_agent.py', type: 'file', size: '7.6 KB', modified: '1 week ago', ...getFileIcon('voice_agent.py') },
    ],
  },
  {
    id: 'f2', name: 'services', type: 'folder', modified: '3 hours ago', icon: <FolderOpen size={18} />, color: 'text-green-500',
    children: [
      { id: 'f2a', name: 'ai_service.py', type: 'file', size: '18.9 KB', modified: '1 day ago', ...getFileIcon('ai_service.py') },
      { id: 'f2b', name: 'auth_service.py', type: 'file', size: '22.4 KB', modified: '2 days ago', ...getFileIcon('auth_service.py') },
      { id: 'f2c', name: 'cache_service.py', type: 'file', size: '15.7 KB', modified: '3 days ago', ...getFileIcon('cache_service.py') },
      { id: 'f2d', name: 'plugin_service.py', type: 'file', size: '19.2 KB', modified: '2 days ago', ...getFileIcon('plugin_service.py') },
    ],
  },
  {
    id: 'f3', name: 'frontend', type: 'folder', modified: '1 hour ago', icon: <FolderOpen size={18} />, color: 'text-purple-500',
    children: [
      { id: 'f3a', name: 'Dashboard.tsx', type: 'file', size: '34.2 KB', modified: '2 hours ago', ...getFileIcon('Dashboard.tsx') },
      { id: 'f3b', name: 'Analytics.tsx', type: 'file', size: '28.1 KB', modified: '4 hours ago', ...getFileIcon('Analytics.tsx') },
      { id: 'f3c', name: 'styles.css', type: 'file', size: '5.8 KB', modified: '1 day ago', ...getFileIcon('styles.css') },
    ],
  },
  {
    id: 'f4', name: 'data', type: 'folder', modified: '6 hours ago', icon: <FolderOpen size={18} />, color: 'text-yellow-500',
    children: [
      { id: 'f4a', name: 'profiles.json', type: 'file', size: '142 KB', modified: '1 day ago', ...getFileIcon('profiles.json') },
      { id: 'f4b', name: 'analytics_export.csv', type: 'file', size: '3.2 MB', modified: '2 days ago', ...getFileIcon('analytics_export.csv') },
      { id: 'f4c', name: 'backup_20240310.zip', type: 'file', size: '45.8 MB', modified: '1 day ago', ...getFileIcon('backup_20240310.zip') },
    ],
  },
  {
    id: 'f5', name: 'docs', type: 'folder', modified: '2 days ago', icon: <FolderOpen size={18} />, color: 'text-cyan-500',
    children: [
      { id: 'f5a', name: 'README.md', type: 'file', size: '4.5 KB', modified: '5 days ago', ...getFileIcon('README.md') },
      { id: 'f5b', name: 'ARCHITECTURE.md', type: 'file', size: '12.3 KB', modified: '1 week ago', ...getFileIcon('ARCHITECTURE.md') },
      { id: 'f5c', name: 'API.md', type: 'file', size: '18.7 KB', modified: '3 days ago', ...getFileIcon('API.md') },
    ],
  },
  {
    id: 'f6', name: 'logs', type: 'folder', modified: '5 min ago', icon: <FolderOpen size={18} />, color: 'text-red-500',
    children: [
      { id: 'f6a', name: 'nexus.log', type: 'file', size: '2.1 MB', modified: '5 min ago', ...getFileIcon('nexus.log') },
      { id: 'f6b', name: 'errors.log', type: 'file', size: '156 KB', modified: '1 hour ago', ...getFileIcon('errors.log') },
      { id: 'f6c', name: 'security.log', type: 'file', size: '890 KB', modified: '30 min ago', ...getFileIcon('security.log') },
    ],
  },
  { id: 'f7', name: 'config.json', type: 'file', size: '2.8 KB', modified: '1 day ago', ...getFileIcon('config.json'), starred: true },
  { id: 'f8', name: 'docker-compose.yml', type: 'file', size: '1.2 KB', modified: '3 days ago', ...getFileIcon('docker-compose.yml') },
  { id: 'f9', name: 'requirements.txt', type: 'file', size: '0.8 KB', modified: '2 days ago', ...getFileIcon('requirements.txt') },
  { id: 'f10', name: 'report_march.pdf', type: 'file', size: '4.5 MB', modified: '1 week ago', ...getFileIcon('report_march.pdf') },
  { id: 'f11', name: 'dashboard_screenshot.png', type: 'file', size: '1.8 MB', modified: '2 days ago', ...getFileIcon('dashboard_screenshot.png') },
];

const FileManager: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'modified'>('name');

  const getCurrentItems = (): FileItem[] => {
    let items = fileSystem;
    for (const segment of currentPath) {
      const folder = items.find(i => i.name === segment && i.type === 'folder');
      if (folder?.children) items = folder.children;
      else break;
    }
    return items;
  };

  const items = useMemo(() => {
    let result = getCurrentItems();
    if (search) {
      result = result.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
    }
    return result.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'modified') return a.modified.localeCompare(b.modified);
      return 0;
    });
  }, [currentPath, search, sortBy]);

  const navigateToFolder = (name: string) => setCurrentPath(prev => [...prev, name]);
  const navigateUp = () => setCurrentPath(prev => prev.slice(0, -1));
  const navigateTo = (index: number) => setCurrentPath(prev => prev.slice(0, index + 1));

  const totalSize = useMemo(() => {
    const folders = fileSystem.filter(f => f.type === 'folder').length;
    const files = fileSystem.filter(f => f.type === 'file').length;
    return { folders, files };
  }, []);

  return (
    <div className="space-y-6 p-6">
      <FadeIn>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <FolderOpen className="text-blue-500" size={32} />
              File Manager
            </h1>
            <p className="text-gray-500 mt-1">{totalSize.folders} folders · {totalSize.files} files</p>
          </div>
          <div className="flex items-center gap-2">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600">
              <Upload size={16} /> Upload
            </motion.button>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium">
              <FolderPlus size={16} /> New Folder
            </motion.button>
          </div>
        </div>
      </FadeIn>

      {/* Storage Overview */}
      <FadeIn delay={0.05}>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <HardDrive size={18} className="text-blue-500" />
              <span className="font-semibold text-gray-900 dark:text-white text-sm">Storage</span>
            </div>
            <span className="text-sm text-gray-500">45.2 GB / 100 GB used</span>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
            <motion.div initial={{ width: 0 }} animate={{ width: '45.2%' }} transition={{ duration: 1 }}
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" />
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /> Documents: 12.3 GB</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-500" /> Media: 18.7 GB</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> Data: 8.4 GB</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-500" /> Other: 5.8 GB</span>
          </div>
        </div>
      </FadeIn>

      {/* Breadcrumb + Search */}
      <FadeIn delay={0.1}>
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-xl px-3 py-2 border border-gray-200 dark:border-gray-700 flex-1 overflow-x-auto">
            <button onClick={() => setCurrentPath([])}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
              <Home size={14} />
            </button>
            {currentPath.map((segment, i) => (
              <React.Fragment key={i}>
                <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
                <button
                  onClick={() => navigateTo(i)}
                  className="text-sm text-gray-700 dark:text-gray-300 hover:text-blue-500 whitespace-nowrap"
                >
                  {segment}
                </button>
              </React.Fragment>
            ))}
          </div>
          <div className="relative w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search files..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setView('grid')} className={`p-2 rounded-lg ${view === 'grid' ? 'bg-gray-200 dark:bg-gray-700' : ''}`}>
              <Grid3X3 size={14} className={view === 'grid' ? 'text-gray-900 dark:text-white' : 'text-gray-400'} />
            </button>
            <button onClick={() => setView('list')} className={`p-2 rounded-lg ${view === 'list' ? 'bg-gray-200 dark:bg-gray-700' : ''}`}>
              <List size={14} className={view === 'list' ? 'text-gray-900 dark:text-white' : 'text-gray-400'} />
            </button>
          </div>
        </div>
      </FadeIn>

      {/* Back Button */}
      {currentPath.length > 0 && (
        <button onClick={navigateUp} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          <ArrowUp size={14} /> Back to parent folder
        </button>
      )}

      {/* File List/Grid */}
      {view === 'list' ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                  onClick={() => setSortBy('name')}>
                  <span className="flex items-center gap-1">Name {sortBy === 'name' && <SortAsc size={10} />}</span>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                  onClick={() => setSortBy('size')}>Size</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                  onClick={() => setSortBy('modified')}>Modified</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {items.map((item, i) => (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer group"
                  onClick={() => item.type === 'folder' ? navigateToFolder(item.name) : setSelectedFile(item)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className={item.type === 'folder' ? 'text-blue-500' : item.color}>{item.icon}</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-blue-500">{item.name}</span>
                      {item.starred && <Star size={12} className="text-yellow-400 fill-yellow-400" />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{item.size || `${item.children?.length || 0} items`}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{item.modified}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={e => e.stopPropagation()} className="p-1 rounded text-gray-400 hover:text-gray-600"><Download size={14} /></button>
                      <button onClick={e => e.stopPropagation()} className="p-1 rounded text-gray-400 hover:text-gray-600"><Edit3 size={14} /></button>
                      <button onClick={e => e.stopPropagation()} className="p-1 rounded text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.02 }}
              whileHover={{ y: -4 }}
              onClick={() => item.type === 'folder' ? navigateToFolder(item.name) : setSelectedFile(item)}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 cursor-pointer group text-center"
            >
              <div className={`text-3xl mb-2 mx-auto ${item.type === 'folder' ? 'text-blue-500' : item.color}`}>
                {item.icon}
              </div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-500">{item.name}</h4>
              <p className="text-xs text-gray-400 mt-1">{item.size || `${item.children?.length || 0} items`}</p>
            </motion.div>
          ))}
        </div>
      )}

      {items.length === 0 && (
        <div className="text-center py-16">
          <FolderOpen size={48} className="text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Empty folder</h3>
        </div>
      )}

      {/* File Preview Modal */}
      <AnimatePresence>
        {selectedFile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedFile(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">File Details</h3>
                <button onClick={() => setSelectedFile(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                  <X size={16} className="text-gray-400" />
                </button>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <span className={`${selectedFile.color}`}>{selectedFile.icon}</span>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">{selectedFile.name}</h4>
                  <p className="text-xs text-gray-500">{selectedFile.size}</p>
                </div>
              </div>
              <div className="space-y-2 mb-6">
                <div className="flex justify-between p-2 rounded bg-gray-50 dark:bg-gray-700/50">
                  <span className="text-sm text-gray-500">Modified</span>
                  <span className="text-sm text-gray-900 dark:text-white">{selectedFile.modified}</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-gray-50 dark:bg-gray-700/50">
                  <span className="text-sm text-gray-500">Size</span>
                  <span className="text-sm text-gray-900 dark:text-white">{selectedFile.size}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium">
                  <Download size={14} /> Download
                </button>
                <button className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium">
                  <Eye size={14} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FileManager;
