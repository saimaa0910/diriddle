const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopApi', {
  isDesktop: true,
  platform: process.platform,
  version: process.env.npm_package_version || '0.1.0',
  sendNotification: (title, body) => ipcRenderer.invoke('desktop:notify', { title, body }),
  setBadgeCount: (count) => ipcRenderer.invoke('desktop:setBadge', count),
  openExternal: (url) => ipcRenderer.invoke('desktop:openExternal', url),
  minimize: () => ipcRenderer.invoke('desktop:minimize'),
  maximize: () => ipcRenderer.invoke('desktop:maximize'),
  close: () => ipcRenderer.invoke('desktop:close'),
  onNavigate: (callback) => {
    ipcRenderer.on('desktop:navigate', (_event, path) => callback(path));
  },
});
