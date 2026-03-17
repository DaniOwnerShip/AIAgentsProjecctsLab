import React, { useState } from 'react'
import styles from './ConnectionPanel.module.css'

export default function ConnectionPanel({ config, setConfig, connected, connecting, error, onConnect, onDisconnect }) {
  const [expanded, setExpanded] = useState(false)

  const statusColor = connected ? 'var(--accent-green)' : error ? 'var(--accent-red)' : 'var(--text-secondary)'
  const statusText  = connected ? 'CONECTADO' : connecting ? 'CONECTANDO…' : error ? 'ERROR' : 'DESCONECTADO'

  return (
    <div className={styles.panel}>
      <div className={styles.header} onClick={() => setExpanded(e => !e)}>
        <div className={styles.statusDot} style={{ background: statusColor,
          boxShadow: connected ? `0 0 8px ${statusColor}` : 'none' }} />
        <span className={styles.statusLabel} style={{ color: statusColor }}>{statusText}</span>
        <span className={styles.ipLabel}>{config.host}:{config.port}</span>
        <span className={styles.chevron}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded ? (
        <div className={styles.body}>
          <div className={styles.row}>
            <label>IP PLC</label>
            <input value={config.host} onChange={e => setConfig(c => ({ ...c, host: e.target.value }))}
              disabled={connected} placeholder="127.168.1.42" />
          </div>
          <div className={styles.row}>
            <label>Puerto</label>
            <input type="number" value={config.port} onChange={e => setConfig(c => ({ ...c, port: +e.target.value }))}
              disabled={connected} placeholder="502" />
          </div>
          <div className={styles.row}>
            <label>Unit ID</label>
            <input type="number" value={config.unitId} onChange={e => setConfig(c => ({ ...c, unitId: +e.target.value }))}
              disabled={connected} placeholder="1" />
          </div>
          {error && <div className={styles.error}>⚠ {error}</div>}
          <button
            className={styles.btn}
            style={{ '--btn-color': connected ? 'var(--accent-red)' : 'var(--accent-green)' }}
            onClick={connected ? onDisconnect : onConnect}
            disabled={connecting}
          >
            {connecting ? '⟳ Conectando…' : connected ? '⏹ Desconectar' : '⏵ Conectar'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
