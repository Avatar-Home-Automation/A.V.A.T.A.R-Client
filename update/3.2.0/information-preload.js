const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  onInitApp: (callback) => ipcRenderer.on('initApp', callback),
  quitInformation: (arg) => ipcRenderer.invoke('quit-information', arg),
  getMsg: (arg) => ipcRenderer.invoke('get-msg', arg),
  showAvatarGithub: (arg) => ipcRenderer.invoke('showAvatarGithub', arg)
})