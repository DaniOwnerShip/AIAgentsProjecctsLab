const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('modbus', {
  connect:       (cfg)  => ipcRenderer.invoke('modbus:connect', cfg),
  disconnect:    ()     => ipcRenderer.invoke('modbus:disconnect'),
  read:          ()     => ipcRenderer.invoke('modbus:read'),
  writeCoil:     (args) => ipcRenderer.invoke('modbus:writeCoil', args),
  writeRegister: (args) => ipcRenderer.invoke('modbus:writeRegister', args),
  startPolling:  (cfg)  => ipcRenderer.invoke('modbus:startPolling', cfg),
  stopPolling:   ()     => ipcRenderer.invoke('modbus:stopPolling'),

  // Listener para datos push (polling automático)
  onData:  (cb) => ipcRenderer.on('modbus:data',  (_, d) => cb(d)),
  onError: (cb) => ipcRenderer.on('modbus:error', (_, e) => cb(e)),
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('modbus:data')
    ipcRenderer.removeAllListeners('modbus:error')
  }
})
