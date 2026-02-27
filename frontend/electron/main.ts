import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  nativeTheme,
  shell,
  screen,
  dialog,
  Menu,
  protocol,
} from 'electron';
import * as path from 'path';
import * as os from 'os';
import { createTray, destroyTray } from './tray';

// ── Constants ──────────────────────────────────────────────────────────────────
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const PROTOCOL_SCHEME = 'nexus';
const MIN_WIDTH = 960;
const MIN_HEIGHT = 640;
const DEFAULT_WIDTH = 1400;
const DEFAULT_HEIGHT = 900;

// ── Single Instance Lock ───────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
}

// ── Window Reference ───────────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;

// ── Deep Linking ───────────────────────────────────────────────────────────────
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL_SCHEME, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL_SCHEME);
}

// ── Create Main Window ─────────────────────────────────────────────────────────
function createMainWindow(): BrowserWindow {
  const { width: screenWidth, height: screenHeight } =
    screen.getPrimaryDisplay().workAreaSize;

  const windowWidth = Math.min(DEFAULT_WIDTH, screenWidth);
  const windowHeight = Math.min(DEFAULT_HEIGHT, screenHeight);

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    frame: false,
    transparent: false,
    backgroundColor: '#0F0F1A',
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    resizable: true,
    center: true,
    show: false,
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.ts'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: true,
      devTools: isDev,
      webSecurity: true,
    },
  });

  // Graceful show when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  // Load content
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Force dark theme
  nativeTheme.themeSource = 'dark';

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Handle navigation
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isDev && url.startsWith('http://localhost:5173')) return;
    event.preventDefault();
    shell.openExternal(url);
  });

  // Window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

// ── IPC Handlers: Window Controls ──────────────────────────────────────────────
ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
  return mainWindow?.isMaximized() ?? false;
});

ipcMain.handle('window:close', () => {
  mainWindow?.close();
});

ipcMain.handle('window:isMaximized', () => {
  return mainWindow?.isMaximized() ?? false;
});

ipcMain.handle('window:setAlwaysOnTop', (_event, flag: boolean) => {
  mainWindow?.setAlwaysOnTop(flag);
});

// ── IPC Handlers: System Info ──────────────────────────────────────────────────
ipcMain.handle('system:info', () => {
  return {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    hostname: os.hostname(),
    username: os.userInfo().username,
    homedir: os.homedir(),
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    cpus: os.cpus().length,
    cpuModel: os.cpus()[0]?.model ?? 'Unknown',
    uptime: os.uptime(),
    osVersion: os.release(),
    osType: os.type(),
  };
});

ipcMain.handle('system:memoryUsage', () => {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    total,
    free,
    used,
    percentUsed: Math.round((used / total) * 100),
  };
});

ipcMain.handle('system:cpuUsage', () => {
  const cpus = os.cpus();
  const avgLoad = cpus.reduce((acc, cpu) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
    const idle = cpu.times.idle;
    return acc + ((total - idle) / total) * 100;
  }, 0) / cpus.length;

  return {
    cores: cpus.length,
    model: cpus[0]?.model ?? 'Unknown',
    avgLoad: Math.round(avgLoad),
  };
});

// ── IPC Handlers: Shell & External ─────────────────────────────────────────────
ipcMain.handle('shell:openExternal', (_event, url: string) => {
  if (url.startsWith('https://') || url.startsWith('http://')) {
    shell.openExternal(url);
  }
});

ipcMain.handle('shell:openPath', (_event, filePath: string) => {
  shell.openPath(filePath);
});

ipcMain.handle('dialog:openFile', async (_event, options: Electron.OpenDialogOptions) => {
  if (!mainWindow) return { canceled: true, filePaths: [] };
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

ipcMain.handle('dialog:saveFile', async (_event, options: Electron.SaveDialogOptions) => {
  if (!mainWindow) return { canceled: true, filePath: '' };
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

// ── IPC Handlers: App Info ─────────────────────────────────────────────────────
ipcMain.handle('app:version', () => {
  return app.getVersion();
});

ipcMain.handle('app:isDev', () => {
  return isDev;
});

ipcMain.handle('app:getPath', (_event, name: string) => {
  return app.getPath(name as any);
});

// ── Global Shortcuts ───────────────────────────────────────────────────────────
function registerGlobalShortcuts(): void {
  // Quick command palette: Ctrl+Space
  globalShortcut.register('CommandOrControl+Space', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      mainWindow.webContents.send('shortcut:quickCommand');
    }
  });

  // Toggle window visibility: Ctrl+Shift+N
  globalShortcut.register('CommandOrControl+Shift+N', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  // Toggle DevTools in dev mode
  if (isDev) {
    globalShortcut.register('CommandOrControl+Shift+I', () => {
      mainWindow?.webContents.toggleDevTools();
    });
  }
}

// ── Application Menu ───────────────────────────────────────────────────────────
function buildApplicationMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Nexus AI',
      submenu: [
        { label: 'About Nexus AI OS', role: 'about' },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        ...(isDev ? [{ role: 'toggleDevTools' as const }] : []),
        { type: 'separator' as const },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' as const },
        { role: 'togglefullscreen' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ── App Lifecycle ──────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Register custom protocol
  protocol.registerFileProtocol(PROTOCOL_SCHEME, (request, callback) => {
    const urlPath = request.url.replace(`${PROTOCOL_SCHEME}://`, '');
    callback({ path: path.normalize(decodeURIComponent(urlPath)) });
  });

  createMainWindow();

  if (mainWindow) {
    createTray(mainWindow);
  }

  registerGlobalShortcuts();
  buildApplicationMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
});

// Second instance handling (deep linking on Windows/Linux)
app.on('second-instance', (_event, commandLine) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();

    const deepLinkUrl = commandLine.find((arg) => arg.startsWith(`${PROTOCOL_SCHEME}://`));
    if (deepLinkUrl) {
      mainWindow.webContents.send('deep-link', deepLinkUrl);
    }
  }
});

// Deep linking on macOS
app.on('open-url', (_event, url) => {
  if (mainWindow) {
    mainWindow.webContents.send('deep-link', url);
  }
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  destroyTray();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  destroyTray();
});

// ── Export for tray access ─────────────────────────────────────────────────────
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
