const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('inventrackLauncher', {
  state: () => ipcRenderer.invoke('launcher:state'),
  open: options => ipcRenderer.invoke('launcher:open', options),
  backup: () => ipcRenderer.invoke('launcher:backup'),
});
