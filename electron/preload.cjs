const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  getVersion: () => ipcRenderer.invoke('app:version'),
  isPackaged: () => ipcRenderer.invoke('app:is-packaged'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // Auto-updater APIs
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  getUpdateStatus: () => ipcRenderer.invoke('updater:get-status'),
  onUpdateStatus: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('updater:status-changed', handler);
    return () => {
      ipcRenderer.removeListener('updater:status-changed', handler);
    };
  },
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
});
