const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

// Load environment variables from .env
const envPath = app.isPackaged
  ? path.join(process.resourcesPath, '.env')
  : path.join(__dirname, '../.env');

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

const isDev = process.env.NODE_ENV === 'development' || (!app.isPackaged && process.env.NODE_ENV !== 'production');

const GITHUB_OWNER = process.env.GITHUB_OWNER || 'savindu19990928';
const GITHUB_REPO = process.env.GITHUB_REPO || 'sunrise_ams';
const GITHUB_TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

let mainWindow = null;

// Updater State
let updaterStatus = {
  status: 'idle', // 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  currentVersion: app.getVersion(),
  updateInfo: null,
  progress: null,
  error: null,
  isDev: isDev,
};

function sendStatusToWindow(status, extra = {}) {
  updaterStatus = {
    ...updaterStatus,
    status,
    ...extra,
    currentVersion: app.getVersion(),
  };

  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.send('updater:status-changed', updaterStatus);
  }
}

// Compare semantic version numbers (e.g. "1.0.1" > "1.0.0")
function compareSemver(v1, v2) {
  const clean1 = (v1 || '').replace(/^v/, '').split('-')[0];
  const clean2 = (v2 || '').replace(/^v/, '').split('-')[0];
  const parts1 = clean1.split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = clean2.split('.').map((p) => parseInt(p, 10) || 0);
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

// Fallback GitHub Release checker (active in dev mode or as a network check)
function fetchLatestGitHubRelease() {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      headers: {
        'User-Agent': 'Sunrise-AMS-Desktop-App',
        Accept: 'application/vnd.github.v3+json',
        ...(GITHUB_TOKEN ? { Authorization: `token ${GITHUB_TOKEN}` } : {}),
      },
    };

    const req = https.get(requestOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const data = JSON.parse(body);
            resolve(data);
          } catch (err) {
            reject(err);
          }
        } else if (res.statusCode === 404) {
          resolve(null);
        } else {
          reject(new Error(`GitHub API returned status ${res.statusCode}: ${body.slice(0, 100)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('GitHub request timed out'));
    });
  });
}

// Lazy-loaded autoUpdater reference
let autoUpdater = null;

function getAutoUpdater() {
  if (!autoUpdater) {
    try {
      const { autoUpdater: updater } = require('electron-updater');
      autoUpdater = updater;

      autoUpdater.autoDownload = false;
      autoUpdater.autoInstallOnAppQuit = true;

      // Note: For public repositories, requestHeaders should NOT be set
      // because auth headers on public download redirects (AWS S3) can trigger 404 or auth failures.

      if (isDev) {
        autoUpdater.forceDevUpdateConfig = true;
      }

      autoUpdater.on('checking-for-update', () => {
        console.log('[Updater] Checking for updates...');
        sendStatusToWindow('checking', { error: null });
      });

      autoUpdater.on('update-available', (info) => {
        console.log('[Updater] Update available:', info.version);
        sendStatusToWindow('available', {
          updateInfo: {
            version: info.version,
            releaseDate: info.releaseDate,
            releaseNotes: info.releaseNotes,
            releaseName: info.releaseName || `Release v${info.version}`,
          },
          error: null,
        });
      });

      autoUpdater.on('update-not-available', (info) => {
        console.log('[Updater] Update not available. Current version is up to date.');
        sendStatusToWindow('not-available', {
          updateInfo: info ? { version: info.version } : null,
          error: null,
        });
      });

      autoUpdater.on('error', (err) => {
        const rawMsg = err ? err.message || err.toString() : '';
        console.error('[Updater] Error:', rawMsg);
        sendStatusToWindow('error', {
          error: formatUpdaterErrorMessage(rawMsg),
        });
      });

      autoUpdater.on('download-progress', (progressObj) => {
        sendStatusToWindow('downloading', {
          progress: {
            bytesPerSecond: progressObj.bytesPerSecond,
            percent: Math.round(progressObj.percent),
            transferred: progressObj.transferred,
            total: progressObj.total,
          },
        });
      });

      autoUpdater.on('update-downloaded', (info) => {
        console.log('[Updater] Update downloaded successfully:', info.version);
        sendStatusToWindow('downloaded', {
          updateInfo: {
            version: info.version,
            releaseDate: info.releaseDate,
            releaseNotes: info.releaseNotes,
            releaseName: info.releaseName || `Release v${info.version}`,
          },
        });
      });
    } catch (err) {
      console.warn('[Updater] Could not initialize electron-updater:', err.message);
    }
  }
  return autoUpdater;
}

function formatUpdaterErrorMessage(msg) {
  if (!msg) return 'Failed to check for updates';
  if (msg.includes('Cannot find latest.yml') || msg.includes('HttpError: 404')) {
    return 'The latest release is still finishing upload on GitHub. Please check again in a minute.';
  }
  return msg;
}

// Check for updates function with automatic single retry for upload race conditions
async function checkForUpdates(silent = false, isRetry = false) {
  sendStatusToWindow('checking', { error: null });

  // In packaged mode, use electron-updater
  if (app.isPackaged) {
    const updater = getAutoUpdater();
    if (updater) {
      try {
        const result = await updater.checkForUpdates();
        return { success: true, result };
      } catch (err) {
        console.error('[Updater] checkForUpdates failed:', err.message);

        // If latest.yml 404 happened right after a new release was published, wait 4s and retry once
        if (!isRetry && (err.message.includes('latest.yml') || err.message.includes('404'))) {
          console.log('[Updater] latest.yml not yet available, retrying in 4 seconds...');
          await new Promise((r) => setTimeout(r, 4000));
          return await checkForUpdates(silent, true);
        }

        const friendlyMsg = formatUpdaterErrorMessage(err.message);
        sendStatusToWindow('error', { error: friendlyMsg });
        return { success: false, error: friendlyMsg };
      }
    }
  }

  // Development mode: Query GitHub Releases directly or try dev update config
  try {
    const updater = getAutoUpdater();
    if (updater && fs.existsSync(path.join(__dirname, '../dev-app-update.yml'))) {
      try {
        const res = await updater.checkForUpdates();
        return { success: true, result: res };
      } catch (devUpdateErr) {
        console.log('[Updater] dev-app-update check failed, falling back to GitHub API:', devUpdateErr.message);
      }
    }

    const release = await fetchLatestGitHubRelease();
    if (!release) {
      sendStatusToWindow('not-available', {
        updateInfo: { version: app.getVersion() },
      });
      return { success: true, available: false };
    }

    const latestVersion = (release.tag_name || '').replace(/^v/, '');
    const currentVersion = app.getVersion().replace(/^v/, '');
    const isNewer = compareSemver(latestVersion, currentVersion) > 0;

    if (isNewer) {
      sendStatusToWindow('available', {
        updateInfo: {
          version: latestVersion,
          releaseDate: release.published_at,
          releaseNotes: release.body,
          releaseName: release.name || `Release ${release.tag_name}`,
          htmlUrl: release.html_url,
        },
        error: null,
      });
      return { success: true, available: true, version: latestVersion };
    } else {
      sendStatusToWindow('not-available', {
        updateInfo: { version: latestVersion },
        error: null,
      });
      return { success: true, available: false };
    }
  } catch (err) {
    console.error('[Updater] GitHub fallback check failed:', err.message);
    if (!silent) {
      sendStatusToWindow('error', { error: err.message });
    }
    return { success: false, error: err.message };
  }
}

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

    // Check for updates shortly after launch (after 3.5s so initial render is smooth)
    setTimeout(() => {
      checkForUpdates(true);
    }, 3500);
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
ipcMain.handle('window:is-maximized', () => (mainWindow ? mainWindow.isMaximized() : false));
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

// IPC handlers for Auto-Updater
ipcMain.handle('updater:get-status', () => {
  return updaterStatus;
});

ipcMain.handle('updater:check', async () => {
  return await checkForUpdates(false);
});

ipcMain.handle('updater:download', async () => {
  if (!app.isPackaged) {
    return {
      success: false,
      message: 'Automatic downloading is available only in the installed/packaged application. In development, updates can be downloaded directly from GitHub Releases.',
    };
  }

  const updater = getAutoUpdater();
  if (!updater) {
    return { success: false, message: 'Auto-updater is not available.' };
  }

  try {
    sendStatusToWindow('downloading', {
      progress: { percent: 0, bytesPerSecond: 0, transferred: 0, total: 0 },
      error: null,
    });
    await updater.downloadUpdate();
    return { success: true };
  } catch (err) {
    console.error('[Updater] downloadUpdate failed:', err);
    sendStatusToWindow('error', { error: err.message });
    return { success: false, error: err.message };
  }
});

ipcMain.handle('updater:install', () => {
  if (!app.isPackaged) {
    return {
      success: false,
      message: 'Restart and install is available only in the installed/packaged application.',
    };
  }

  const updater = getAutoUpdater();
  if (updater) {
    updater.quitAndInstall(true, true);
    return { success: true };
  }
  return { success: false, message: 'Updater not available' };
});

ipcMain.handle('shell:open-external', async (_event, url) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    await shell.openExternal(url);
    return true;
  }
  return false;
});
