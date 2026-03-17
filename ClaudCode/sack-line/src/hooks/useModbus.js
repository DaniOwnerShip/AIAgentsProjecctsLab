import { useState, useEffect, useCallback, useRef } from 'react'

const DEFAULT_CONFIG = { host: '127.168.1.42', port: 502, unitId: 1 }

// En dev sin Electron, usamos datos simulados
const isElectron = typeof window !== 'undefined' && !!window.modbus

export function useModbus() {
  const [config, setConfig]         = useState(DEFAULT_CONFIG)
  const [connected, setConnected]   = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError]           = useState(null)
  const [plcData, setPlcData]       = useState({ marcha: false, paro: true, velocidad: 0 })

  // Simulación para desarrollo sin PLC
  const simRef = useRef(null)
  const simState = useRef({ marcha: false, velocidad: 0, offset: 0 })

  // ── Conectar ──────────────────────────────────────────────────────────────
  const connect = useCallback(async (cfg = config) => {
    setConnecting(true)
    setError(null)
    try {
      if (isElectron) {
        const cleanCfg = {
          host: String(cfg?.host || '127.168.1.42'),
          port: Number(cfg?.port || 502),
          unitId: Number(cfg?.unitId || 1)
        }
        console.log('[Renderer] Connecting with config:', cleanCfg)
        const res = await window.modbus.connect(cleanCfg)
        if (!res.ok) throw new Error(res.error)
        window.modbus.onData(data => setPlcData(data))
        window.modbus.onError(err => setError(err))
        await window.modbus.startPolling({ intervalMs: 500 })
        setConnected(true)
      } else {
        // Modo simulación (dev browser)
        await new Promise(r => setTimeout(r, 800))
        setConnected(true)
        startSimulation()
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setConnecting(false)
    }
  }, [config])

  // ── Desconectar ───────────────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    if (isElectron) {
      window.modbus.removeAllListeners()
      await window.modbus.stopPolling()
      await window.modbus.disconnect()
    } else {
      stopSimulation()
    }
    setConnected(false)
    setPlcData({ marcha: false, paro: true, velocidad: 0 })
  }, [])

  // ── Escribir Marcha (coil 0) ──────────────────────────────────────────────
  const setMarcha = useCallback(async (value) => {
    if (!connected) return
    if (isElectron) {
      await window.modbus.writeCoil({ address: 0, value })
      await window.modbus.writeCoil({ address: 1, value: !value })
    } else {
      simState.current.marcha = value
      setPlcData(d => ({ ...d, marcha: value, paro: !value }))
    }
  }, [connected])

  // ── Escribir Velocidad (registro 0) ──────────────────────────────────────
  const setVelocidad = useCallback(async (value) => {
    if (!connected) return
    const intVal = Math.round(value)
    if (isElectron) {
      await window.modbus.writeRegister({ address: 0, value: intVal })
    } else {
      simState.current.velocidad = intVal
      setPlcData(d => ({ ...d, velocidad: intVal }))
    }
  }, [connected])

  // ── Simulación ────────────────────────────────────────────────────────────
  function startSimulation() {
    simState.current = { marcha: false, velocidad: 30 }
    setPlcData({ marcha: false, paro: true, velocidad: 30 })
    simRef.current = setInterval(() => {
      const { marcha, velocidad } = simState.current
      setPlcData({ marcha, paro: !marcha, velocidad })
    }, 500)
  }

  function stopSimulation() {
    if (simRef.current) { clearInterval(simRef.current); simRef.current = null }
  }

  useEffect(() => () => {
    if (isElectron) window.modbus?.removeAllListeners()
    stopSimulation()
  }, [])

  return {
    config, setConfig,
    connected, connecting, error,
    plcData,
    connect, disconnect,
    setMarcha, setVelocidad
  }
}
