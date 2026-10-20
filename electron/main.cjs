const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development' || (!app.isPackaged && process.env.NODE_ENV !== 'production');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Sunrise Apartments AMS',
    backgroundColor: '#f4f6f8',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in external browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (isDev) {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173';
    let isLoaded = false;
    let retryTimer = null;

    const scheduleRetry = () => {
      if (isLoaded || retryTimer || !mainWindow || mainWindow.isDestroyed()) return;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        if (!isLoaded && mainWindow && !mainWindow.isDestroyed()) {
          loadServer();
        }
      }, 1000);
    };

    const loadServer = () => {
      mainWindow.loadURL(devServerUrl).catch((err) => {
        console.log(`[Dev] Waiting for dev server at ${devServerUrl}... (${err.code || err.message})`);
        scheduleRetry();
      });
    };

    mainWindow.webContents.on('did-finish-load', () => {
      isLoaded = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    });

    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
      if (!isLoaded) {
        console.log(`[Dev] Load failed (${errorDescription || errorCode}), retrying...`);
        scheduleRetry();
      }
    });

    mainWindow.on('closed', () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      mainWindow = null;
    });

    loadServer();
  } else {
    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      console.error(`[Renderer Failed Load] code: ${errorCode}, desc: ${errorDescription}, url: ${validatedURL}`);
    });

    mainWindow.loadFile(path.join(__dirname, '../dist/index.html')).catch((err) => {
      console.error('[loadFile error]', err);
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }
}

// Ensure single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers for desktop integration
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:is-packaged', () => app.isPackaged);
ipcMain.handle('window:is-maximized', () => mainWindow ? mainWindow.isMaximized() : false);
ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});
ipcMain.on('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});
ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close();
});
