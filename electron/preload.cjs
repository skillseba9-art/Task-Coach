const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveData: (data) => ipcRenderer.invoke('save-data', data),
  loadData: () => ipcRenderer.invoke('load-data'),
  onPowerEvent: (callback) => ipcRenderer.on('power-event', (event, type) => callback(type)),
  removePowerListeners: () => ipcRenderer.removeAllListeners('power-event')
});
