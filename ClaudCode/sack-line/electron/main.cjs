const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

let mainWindow
let modbusClient = null
let pollingInterval = null

let connectionState = {
  isConnected: false,
  host: null,
  port: null,
  unitId: null
}

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
      nodeIntegration: false,
      webSecurity: true
    }
  })

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const isDev = !app.isPackaged
    const csp = isDev
      ? "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:* ws://localhost:* ws://127.0.0.1:* http://127.0.0.1:*; img-src 'self' data:; font-src 'self';"
      : "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self';"
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    })
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://localhost') || url.startsWith('https://')) {
      require('electron').shell.openExternal(url)
    }
    return { action: 'deny' }
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
ipcMain.handle('modbus:connect', async (_event, cfg) => {
  console.log('[Modbus] connect received, cfg:', JSON.stringify(cfg))
  try {
    if (!cfg || typeof cfg !== 'object') {
      return { ok: false, error: 'Config inválida' }
    }
    const host = String(cfg?.host || '127.168.1.42')
    const port = Number(cfg?.port || 502)
    const unitId = Number(cfg?.unitId || 1)

    if (!host || typeof host !== 'string' || host.length === 0) {
      return { ok: false, error: 'Host inválido' }
    }
    if (isNaN(port) || port < 1 || port > 65535) {
      return { ok: false, error: 'Puerto inválido' }
    }
    if (isNaN(unitId) || unitId < 1 || unitId > 255) {
      return { ok: false, error: 'Unit ID inválido' }
    }

    const ModbusRTU = getModbusSerial()
    if (!ModbusRTU) {
      console.log('[Modbus] modbus-serial not available')
      return { ok: false, error: 'modbus-serial no disponible' }
    }

    if (modbusClient) {
      try { modbusClient.close() } catch (_) {}
      modbusClient = null
    }

    const client = new ModbusRTU()
    client.setID(unitId)
    client.setTimeout(3000)

    console.log('[Modbus] Attempting TCP connection to', host, port)
    await client.connectTCP(host, { port })
    console.log('[Modbus] TCP connected')

    modbusClient = client
    connectionState = { isConnected: true, host, port, unitId }
    console.log('[Modbus] Connected successfully, returning ok: true')
    return { ok: true }
  } catch (ex) {
    const msg = (ex && ex.message) ? String(ex.message) : 'Excepción inesperada'
    console.error('[Modbus] Exception:', msg)
    return { ok: false, error: msg }
  }
})

// ── IPC: Desconectar ──────────────────────────────────────────────────────
ipcMain.handle('modbus:disconnect', async () => {
  stopPolling()
  if (modbusClient) {
    try { modbusClient.close() } catch (_) {}
    modbusClient = null
  }
  connectionState = { isConnected: false, host: null, port: null, unitId: null }
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
    if (!coils || !regs || !coils.data || !regs.data) {
      return { ok: false, error: 'Datos inválidos del dispositivo' }
    }
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
  if (typeof address !== 'number' || isNaN(address) || address < 0) {
    return { ok: false, error: 'Dirección inválida' }
  }
  if (typeof value !== 'boolean' && typeof value !== 'number') {
    return { ok: false, error: 'Valor inválido' }
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
  if (typeof address !== 'number' || isNaN(address) || address < 0) {
    return { ok: false, error: 'Dirección inválida' }
  }
  if (typeof value !== 'number' || isNaN(value)) {
    return { ok: false, error: 'Valor inválido' }
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
  console.log('[Modbus] startPolling received, interval:', intervalMs)
  const interval = Number(intervalMs) || 500
  if (isNaN(interval) || interval < 100) {
    return { ok: false, error: 'Intervalo mínimo es 100ms' }
  }
  stopPolling()
  pollingInterval = setInterval(async () => {
    if (!connectionState.isConnected || !modbusClient || !modbusClient.isOpen) return
    if (!mainWindow || mainWindow.isDestroyed()) {
      stopPolling()
      return
    }
    try {
      const coils = await modbusClient.readCoils(0, 2)
      const regs  = await modbusClient.readHoldingRegisters(0, 1)
      const data = {
        marcha:    !!coils.data[0],
        paro:      !!coils.data[1],
        velocidad: Number(regs.data[0])
      }
      console.log('[Modbus] Sending data:', data)
      mainWindow?.webContents.send('modbus:data', data)
    } catch (err) {
      console.log('[Modbus] Polling error:', err.message)
      mainWindow?.webContents.send('modbus:error', String((err && err.message) || err))
    }
  }, interval)
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
