const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

let mainWindow
let modbusClient = null
let pollingInterval = null

function getModbusSerial() {
  try {
    return require('modbus-serial')
  } catch (e) {
    console.error('modbus-serial no disponible:', e.message)
    return null
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#0d1117',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const isDev = !app.isPackaged
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

// ── IPC: Conectar ─────────────────────────────────────────────────────────
// Usamos callback en lugar de await para evitar que modbus-serial
// propague objetos Error no serializables por el canal IPC de Electron.
ipcMain.handle('modbus:connect', (_event, cfg) => {
  return new Promise((resolve) => {
    try {
      const host   = String(cfg.host   || '127.168.1.42')
      const port   = Number(cfg.port   || 502)
      const unitId = Number(cfg.unitId || 1)

      const ModbusRTU = getModbusSerial()
      if (!ModbusRTU) {
        resolve({ ok: false, error: 'modbus-serial no disponible' })
        return
      }

      if (modbusClient) {
        try { modbusClient.close() } catch (_) {}
        modbusClient = null
      }

      const client = new ModbusRTU()
      client.setID(unitId)
      client.setTimeout(3000)

      // connectTCP acepta callback como tercer argumento
      client.connectTCP(host, { port }, (err) => {
        if (err) {
          const msg = (err && err.message) ? String(err.message) : 'Error de conexión TCP'
          console.error('[Modbus] connect error:', msg)
          resolve({ ok: false, error: msg })
        } else {
          modbusClient = client
          console.log('[Modbus] Conectado a', host + ':' + port)
          resolve({ ok: true })
        }
      })
    } catch (ex) {
      const msg = (ex && ex.message) ? String(ex.message) : 'Excepción inesperada'
      console.error('[Modbus] excepción:', msg)
      resolve({ ok: false, error: msg })
    }
  })
})

// ── IPC: Desconectar ──────────────────────────────────────────────────────
ipcMain.handle('modbus:disconnect', async () => {
  stopPolling()
  if (modbusClient) {
    try { modbusClient.close() } catch (_) {}
    modbusClient = null
  }
  return { ok: true }
})

// ── IPC: Leer datos ───────────────────────────────────────────────────────
ipcMain.handle('modbus:read', async () => {
  if (!modbusClient || !modbusClient.isOpen) {
    return { ok: false, error: 'No conectado' }
  }
  try {
    const coils = await modbusClient.readCoils(0, 2)
    const regs  = await modbusClient.readHoldingRegisters(0, 1)
    return {
      ok: true,
      data: {
        marcha:    !!coils.data[0],
        paro:      !!coils.data[1],
        velocidad: Number(regs.data[0])
      }
    }
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) }
  }
})

// ── IPC: Escribir bobina ──────────────────────────────────────────────────
ipcMain.handle('modbus:writeCoil', async (_event, { address, value }) => {
  if (!modbusClient || !modbusClient.isOpen) {
    return { ok: false, error: 'No conectado' }
  }
  try {
    await modbusClient.writeCoil(Number(address), !!value)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) }
  }
})

// ── IPC: Escribir registro ────────────────────────────────────────────────
ipcMain.handle('modbus:writeRegister', async (_event, { address, value }) => {
  if (!modbusClient || !modbusClient.isOpen) {
    return { ok: false, error: 'No conectado' }
  }
  try {
    await modbusClient.writeRegister(Number(address), Number(value))
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) }
  }
})

// ── IPC: Iniciar polling ──────────────────────────────────────────────────
ipcMain.handle('modbus:startPolling', (_event, { intervalMs }) => {
  stopPolling()
  pollingInterval = setInterval(async () => {
    if (!modbusClient || !modbusClient.isOpen) return
    try {
      const coils = await modbusClient.readCoils(0, 2)
      const regs  = await modbusClient.readHoldingRegisters(0, 1)
      mainWindow?.webContents.send('modbus:data', {
        marcha:    !!coils.data[0],
        paro:      !!coils.data[1],
        velocidad: Number(regs.data[0])
      })
    } catch (err) {
      mainWindow?.webContents.send('modbus:error', String((err && err.message) || err))
    }
  }, Number(intervalMs) || 500)
  return { ok: true }
})

ipcMain.handle('modbus:stopPolling', () => {
  stopPolling()
  return { ok: true }
})

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }
}
