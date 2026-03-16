import React from 'react'
import { useModbus } from './hooks/useModbus'
import ProductionLine from './components/ProductionLine'
import ConnectionPanel from './components/ConnectionPanel'
import ControlPanel from './components/ControlPanel'
import styles from './App.module.css'

export default function App() {
  const {
    config, setConfig,
    connected, connecting, error,
    plcData,
    connect, disconnect,
    setMarcha, setVelocidad
  } = useModbus()

  const { marcha, velocidad } = plcData

  return (
    <div className={styles.root}>
      {/* ── CABECERA ─────────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="1" y="9" width="22" height="6" rx="1" fill="var(--accent-blue)" opacity="0.9"/>
            <rect x="4" y="6" width="3" height="12" rx="1" fill="var(--accent-blue)"/>
            <rect x="17" y="6" width="3" height="12" rx="1" fill="var(--accent-blue)"/>
            <circle cx="3" cy="12" r="3" fill="var(--accent-cyan)" stroke="var(--bg-base)" strokeWidth="1"/>
            <circle cx="21" cy="12" r="3" fill="var(--accent-cyan)" stroke="var(--bg-base)" strokeWidth="1"/>
          </svg>
          <span className={styles.logoText}>SACK<span className={styles.logoAccent}>LINE</span></span>
          <span className={styles.logoSub}>MONITOR</span>
        </div>
        <div className={styles.headerRight}>
          <Clock />
        </div>
      </header>

      {/* ── CUERPO PRINCIPAL ─────────────────────────────────── */}
      <main className={styles.main}>
        {/* Visualización SVG */}
        <section className={styles.visualization}>
          <div className={styles.vizHeader}>
            <span className={styles.vizTitle}>LÍNEA DE PRODUCCIÓN — VISTA ESQUEMÁTICA</span>
            <span className={styles.vizSub}>Modbus TCP/IP · Polling 500ms</span>
          </div>
          <div className={`${styles.vizCanvas} scanlines`}>
            <ProductionLine marcha={marcha} velocidad={velocidad} />
          </div>
        </section>

        {/* Panel derecho */}
        <aside className={styles.sidebar}>
          <ConnectionPanel
            config={config}
            setConfig={setConfig}
            connected={connected}
            connecting={connecting}
            error={error}
            onConnect={connect}
            onDisconnect={disconnect}
          />
          <ControlPanel
            marcha={marcha}
            velocidad={velocidad}
            connected={connected}
            onMarcha={() => setMarcha(true)}
            onParo={()   => setMarcha(false)}
            onVelocidad={setVelocidad}
          />
          <DataLog plcData={plcData} connected={connected} />
        </aside>
      </main>

      {/* ── PIE ──────────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <span>SackLine Monitor v1.0</span>
        <span>Electron + React + Modbus TCP/IP</span>
        <span style={{ color: connected ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
          ● {connected ? `${config.host}:${config.port}` : 'Sin conexión'}
        </span>
      </footer>
    </div>
  )
}

// ── Reloj ────────────────────────────────────────────────────────────────────
function Clock() {
  const [time, setTime] = React.useState(new Date())
  React.useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-secondary)' }}>
      {time.toLocaleTimeString('es-ES')}
    </span>
  )
}

// ── Log de datos ─────────────────────────────────────────────────────────────
function DataLog({ plcData, connected }) {
  const [log, setLog] = React.useState([])
  React.useEffect(() => {
    if (!connected) return
    const entry = {
      ts: new Date().toLocaleTimeString('es-ES'),
      ...plcData
    }
    setLog(prev => [entry, ...prev].slice(0, 20))
  }, [plcData.marcha, plcData.velocidad, connected])

  return (
    <div style={{
      background: 'var(--bg-base)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      padding: '10px',
      fontFamily: 'var(--font-mono)',
      fontSize: '10px',
      flex: 1,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }}>
      <div style={{ color: 'var(--text-secondary)', letterSpacing: '0.1em', marginBottom: 4, fontSize: 10 }}>
        LOG DE DATOS
      </div>
      <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {log.length === 0 && (
          <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            {connected ? 'Esperando cambios…' : 'Sin conexión'}
          </span>
        )}
        {log.map((e, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, opacity: 1 - i * 0.04 }}>
            <span style={{ color: 'var(--text-secondary)' }}>{e.ts}</span>
            <span style={{ color: e.marcha ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {e.marcha ? 'MARCHA' : 'PARO  '}
            </span>
            <span style={{ color: 'var(--accent-amber)' }}>
              VEL:{String(Math.round(e.velocidad)).padStart(3, '0')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
