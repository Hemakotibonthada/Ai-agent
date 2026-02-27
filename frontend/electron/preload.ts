import { contextBridge, ipcRenderer, clipboard } from 'electron';

// ── Types ──────────────────────────────────────────────────────────────────────
interface SystemInfo {
  platform: string;
  arch: string;
  nodeVersion: string;
  electronVersion: string;
  chromeVersion: string;
  hostname: string;
  username: string;
  homedir: string;
  totalMemory: number;
  freeMemory: number;
  cpus: number;
  cpuModel: string;
  uptime: number;
  osVersion: string;
  osType: string;
}

interface MemoryUsage {
  total: number;
  free: number;
  used: number;
  percentUsed: number;
}

interface CpuUsage {
  cores: number;
  model: string;
  avgLoad: number;
}

// ── Exposed API ────────────────────────────────────────────────────────────────
const nexusAPI = {
  // ── Window Controls ────────────────────────────────────────────────────────
  window: {
    minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
    maximize: (): Promise<boolean> => ipcRenderer.invoke('window:maximize'),
    close: (): Promise<void> => ipcRenderer.invoke('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
    setAlwaysOnTop: (flag: boolean): Promise<void> =>
      ipcRenderer.invoke('window:setAlwaysOnTop', flag),
  },

  // ── System Information ─────────────────────────────────────────────────────
  system: {
    getInfo: (): Promise<SystemInfo> => ipcRenderer.invoke('system:info'),
    getMemoryUsage: (): Promise<MemoryUsage> => ipcRenderer.invoke('system:memoryUsage'),
    getCpuUsage: (): Promise<CpuUsage> => ipcRenderer.invoke('system:cpuUsage'),
  },

  // ── Shell Operations ───────────────────────────────────────────────────────
  shell: {
    openExternal: (url: string): Promise<void> =>
      ipcRenderer.invoke('shell:openExternal', url),
    openPath: (filePath: string): Promise<void> =>
      ipcRenderer.invoke('shell:openPath', filePath),
  },

  // ── Dialog Operations ──────────────────────────────────────────────────────
  dialog: {
    openFile: (options?: Record<string, unknown>): Promise<{ canceled: boolean; filePaths: string[] }> =>
      ipcRenderer.invoke('dialog:openFile', options ?? {}),
    saveFile: (options?: Record<string, unknown>): Promise<{ canceled: boolean; filePath?: string }> =>
      ipcRenderer.invoke('dialog:saveFile', options ?? {}),
  },

  // ── Clipboard ──────────────────────────────────────────────────────────────
  clipboard: {
    readText: (): string => clipboard.readText(),
    writeText: (text: string): void => clipboard.writeText(text),
    readHTML: (): string => clipboard.readHTML(),
    writeHTML: (html: string): void => clipboard.writeHTML(html),
    clear: (): void => clipboard.clear(),
    has: (format: string): boolean => clipboard.has(format),
  },

  // ── Notifications ──────────────────────────────────────────────────────────
  notification: {
    show: (title: string, body: string, options?: { icon?: string; silent?: boolean }): void => {
      new Notification(title, {
        body,
        icon: options?.icon,
        silent: options?.silent ?? false,
      });
    },
  },

  // ── App Info ───────────────────────────────────────────────────────────────
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
    isDev: (): Promise<boolean> => ipcRenderer.invoke('app:isDev'),
    getPath: (name: string): Promise<string> => ipcRenderer.invoke('app:getPath', name),
  },

  // ── Event Listeners ────────────────────────────────────────────────────────
  on: (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    const allowedChannels = [
      'shortcut:quickCommand',
      'deep-link',
      'tray:showQuickCommand',
      'tray:openSettings',
      'app:update-available',
      'app:update-downloaded',
    ];

    if (!allowedChannels.includes(channel)) {
      console.warn(`IPC channel "${channel}" is not allowed in preload.`);
      return () => {};
    }

    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => {
      callback(...args);
    };

    ipcRenderer.on(channel, listener);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
};

// ── Expose to Renderer ─────────────────────────────────────────────────────────
contextBridge.exposeInMainWorld('nexus', nexusAPI);

// ── Type Declaration for Renderer ──────────────────────────────────────────────
export type NexusAPI = typeof nexusAPI;
