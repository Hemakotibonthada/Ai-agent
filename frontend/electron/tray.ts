import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import * as path from 'path';

// ── State ──────────────────────────────────────────────────────────────────────
let tray: Tray | null = null;
let mainWindowRef: BrowserWindow | null = null;
let notificationBadge = false;

// ── Icon Paths ─────────────────────────────────────────────────────────────────
function getIconPath(): string {
  const iconName = process.platform === 'win32' ? 'tray-icon.ico' : 'tray-icon.png';
  const basePath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '..', 'public');
  return path.join(basePath, iconName);
}

function getBadgeIconPath(): string {
  const iconName = process.platform === 'win32' ? 'tray-icon-badge.ico' : 'tray-icon-badge.png';
  const basePath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '..', 'public');
  return path.join(basePath, iconName);
}

// ── Build Context Menu ─────────────────────────────────────────────────────────
function buildContextMenu(): Menu {
  const isVisible = mainWindowRef?.isVisible() ?? false;

  return Menu.buildFromTemplate([
    {
      label: 'Nexus AI OS',
      enabled: false,
      icon: nativeImage.createEmpty(),
    },
    { type: 'separator' },
    {
      label: isVisible ? 'Hide Window' : 'Show Window',
      click: () => {
        if (!mainWindowRef) return;
        if (mainWindowRef.isVisible()) {
          mainWindowRef.hide();
        } else {
          mainWindowRef.show();
          mainWindowRef.focus();
        }
      },
      accelerator: 'CmdOrCtrl+Shift+N',
    },
    {
      label: 'Quick Command',
      click: () => {
        if (!mainWindowRef) return;
        if (!mainWindowRef.isVisible()) {
          mainWindowRef.show();
        }
        mainWindowRef.focus();
        mainWindowRef.webContents.send('shortcut:quickCommand');
      },
      accelerator: 'CmdOrCtrl+Space',
    },
    { type: 'separator' },
    {
      label: 'Dashboard',
      click: () => {
        showAndNavigate('/dashboard');
      },
    },
    {
      label: 'Chat',
      click: () => {
        showAndNavigate('/chat');
      },
    },
    {
      label: 'Tasks',
      click: () => {
        showAndNavigate('/tasks');
      },
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        if (!mainWindowRef) return;
        if (!mainWindowRef.isVisible()) {
          mainWindowRef.show();
        }
        mainWindowRef.focus();
        mainWindowRef.webContents.send('tray:openSettings');
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Nexus',
      click: () => {
        app.quit();
      },
      accelerator: 'CmdOrCtrl+Q',
    },
  ]);
}

// ── Helper: Show Window and Navigate ───────────────────────────────────────────
function showAndNavigate(route: string): void {
  if (!mainWindowRef) return;
  if (!mainWindowRef.isVisible()) {
    mainWindowRef.show();
  }
  mainWindowRef.focus();
  mainWindowRef.webContents.send('tray:navigate', route);
}

// ── Create System Tray ─────────────────────────────────────────────────────────
export function createTray(mainWindow: BrowserWindow): Tray {
  mainWindowRef = mainWindow;

  const iconPath = getIconPath();
  let icon: Electron.NativeImage;

  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      // Fallback: create a simple 16x16 icon programmatically
      icon = createFallbackIcon();
    }
  } catch {
    icon = createFallbackIcon();
  }

  tray = new Tray(icon);
  tray.setToolTip('Nexus AI OS');
  tray.setContextMenu(buildContextMenu());

  // Single click: toggle window visibility
  tray.on('click', () => {
    if (!mainWindowRef) return;
    if (mainWindowRef.isVisible()) {
      mainWindowRef.hide();
    } else {
      mainWindowRef.show();
      mainWindowRef.focus();
    }
    // Rebuild context menu to update Show/Hide label
    tray?.setContextMenu(buildContextMenu());
  });

  // Double click: show and focus
  tray.on('double-click', () => {
    if (!mainWindowRef) return;
    mainWindowRef.show();
    mainWindowRef.focus();
  });

  // Update context menu when window visibility changes
  mainWindow.on('show', () => tray?.setContextMenu(buildContextMenu()));
  mainWindow.on('hide', () => tray?.setContextMenu(buildContextMenu()));

  return tray;
}

// ── Notification Badge ─────────────────────────────────────────────────────────
export function setNotificationBadge(hasBadge: boolean): void {
  if (!tray) return;
  notificationBadge = hasBadge;

  const iconPath = hasBadge ? getBadgeIconPath() : getIconPath();

  try {
    const icon = nativeImage.createFromPath(iconPath);
    if (!icon.isEmpty()) {
      tray.setImage(icon);
    }
  } catch {
    // Silently fail if badge icon not found
  }

  tray.setToolTip(hasBadge ? 'Nexus AI OS (New Notifications)' : 'Nexus AI OS');
}

export function hasNotificationBadge(): boolean {
  return notificationBadge;
}

// ── Fallback Icon ──────────────────────────────────────────────────────────────
function createFallbackIcon(): Electron.NativeImage {
  // Create a minimal 16x16 PNG with a blue dot (Nexus brand color)
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - size / 2;
      const dy = y - size / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < size / 2 - 1) {
        canvas[idx] = 0x3b;     // R
        canvas[idx + 1] = 0x82; // G
        canvas[idx + 2] = 0xf6; // B
        canvas[idx + 3] = 0xff; // A
      } else {
        canvas[idx + 3] = 0x00; // Transparent
      }
    }
  }

  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

// ── Destroy Tray ───────────────────────────────────────────────────────────────
export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
  mainWindowRef = null;
}
