import React from 'react'
import { useModbus } from './hooks/useModbus'
import ProductionLine from './components/ProductionLine'
import ConnectionPanel from './components/ConnectionPanel'
import ControlPanel from './components/ControlPanel'
import { Clock } from './components/Clock'
import { DataLog } from './components/DataLog'
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
