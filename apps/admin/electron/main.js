const { app, BrowserWindow, ipcMain, Notification, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const { createApplicationMenu } = require('./menu');
const { startStaticServer } = require('./server');

let mainWindow = null;
let tray = null;
let nextServerProcess = null;
let localStaticServer = null;

const PORT = process.env.PORT || 3001;
const TARGET_URL = process.env.ELECTRON_START_URL || `http://127.0.0.1:${PORT}`;

function isServerReady(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ready = await isServerReady(url);
    if (ready) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function startNextProductionServer() {
  const nextBin = path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'bin', 'next');
  nextServerProcess = spawn(process.execPath, [nextBin, 'start', '-p', String(PORT)], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT) },
    stdio: 'ignore',
  });

  nextServerProcess.on('error', (err) => {
    console.error('Failed to spawn Next.js production server:', err);
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#090B0F',
    title: 'diriddle Admin Command Center',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  createApplicationMenu(mainWindow);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  try {
    // Generate an in-memory 16x16 icon for system tray
    const iconBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAZElEQVQ4T2NkoBAwUqifYdQAUjT8' +
      'B+EgFmwKn72HwfgfPqD4PwzD/yPjw/GfPz8D8V8kYfgfPtz6H1Xw/18Qfvj/j4eX/4vB+H8eH/7' +
      'jE4bhv38Z/x/E4f/jF4bhP2/g+P///w8v/w8AAHq4KqW39kZ9AAAAAElFTkSuQmCC';
    const trayIcon = nativeImage.createFromBuffer(Buffer.from(iconBase64, 'base64'));

    tray = new Tray(trayIcon);
    tray.setToolTip('diriddle Admin Desktop');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open Admin Console',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      {
        label: 'Moderation Reports',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('desktop:navigate', '/dashboard/reports');
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Quit Admin Desktop',
        click: () => {
          app.isQuitting = true;
          app.quit();
        },
      },
    ]);

    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (err) {
    console.warn('System tray initialization skipped:', err.message);
  }
}

// IPC Handlers
ipcMain.handle('desktop:notify', (_event, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({
      title: title || 'diriddle Admin Alert',
      body: body || '',
      silent: false,
    }).show();
    return true;
  }
  return false;
});

ipcMain.handle('desktop:setBadge', (_event, count) => {
  if (process.platform === 'darwin') {
    app.setBadgeCount(count || 0);
  }
  return true;
});

ipcMain.handle('desktop:openExternal', (_event, url) => {
  if (url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:'))) {
    shell.openExternal(url);
    return true;
  }
  return false;
});

ipcMain.handle('desktop:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('desktop:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('desktop:close', () => {
  if (mainWindow) mainWindow.close();
});

app.whenReady().then(async () => {
  let targetUrl = TARGET_URL;
  const outDir = path.join(__dirname, '..', 'out');

  if (fs.existsSync(outDir) && process.env.NODE_ENV !== 'development') {
    try {
      const staticInstance = await startStaticServer(outDir, PORT);
      localStaticServer = staticInstance.server;
      targetUrl = staticInstance.url;
    } catch {
      targetUrl = TARGET_URL;
    }
  } else {
    const ready = await isServerReady(TARGET_URL);
    if (!ready && process.env.NODE_ENV !== 'development') {
      startNextProductionServer();
    }
    await waitForServer(TARGET_URL, 45000);
  }

  createMainWindow();
  createTray();

  await mainWindow.loadURL(targetUrl);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('before-quit', () => {
  if (localStaticServer) {
    localStaticServer.close();
    localStaticServer = null;
  }
  if (nextServerProcess) {
    nextServerProcess.kill();
    nextServerProcess = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
