import React from 'react'
import styles from './ControlPanel.module.css'

export default function ControlPanel({ marcha, velocidad, connected, onMarcha, onParo, onVelocidad }) {

  return (
    <div className={styles.panel}>
      <div className={styles.title}>CONTROL DE LÍNEA</div>

      {/* ── Marcha / Paro ────────────────────────────────────── */}
      <div className={styles.buttons}>
        <button
          className={`${styles.btn} ${styles.btnMarcha}`}
          disabled={!connected || marcha}
          onClick={onMarcha}
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <polygon points="3,2 13,8 3,14" fill="currentColor" />
          </svg>
          MARCHA
        </button>

        <button
          className={`${styles.btn} ${styles.btnParo}`}
          disabled={!connected || !marcha}
          onClick={onParo}
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <rect x="3" y="2" width="4" height="12" fill="currentColor" />
            <rect x="9" y="2" width="4" height="12" fill="currentColor" />
          </svg>
          PARO
        </button>
      </div>

      {/* ── Velocidad ────────────────────────────────────────── */}
      <div className={styles.speedSection}>
        <div className={styles.speedHeader}>
          <span className={styles.speedLabel}>VELOCIDAD</span>
          <span className={styles.speedValue}>{Math.round(velocidad)}<span className={styles.speedUnit}>%</span></span>
        </div>

        <div className={styles.sliderWrap}>
          <input
            type="range" min="0" max="100" step="1"
            value={velocidad}
            disabled={!connected}
            onChange={e => onVelocidad(+e.target.value)}
            className={styles.slider}
            style={{ '--pct': `${velocidad}%` }}
          />
          <div className={styles.sliderTicks}>
            {[0, 25, 50, 75, 100].map(t => (
              <span key={t} style={{ left: `${t}%` }}>{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Estado señales PLC ───────────────────────────────── */}
      <div className={styles.signals}>
        <div className={styles.signalRow}>
          <span className={styles.sigDot} style={{
            background: marcha ? 'var(--accent-green)' : '#1a2535',
            boxShadow: marcha ? '0 0 6px var(--accent-green)' : 'none'
          }} />
          <span className={styles.sigName}>Coil 0</span>
          <span className={styles.sigLabel} style={{ color: marcha ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
            MARCHA {marcha ? '▲1' : '▼0'}
          </span>
        </div>
        <div className={styles.signalRow}>
          <span className={styles.sigDot} style={{
            background: !marcha ? 'var(--accent-red)' : '#1a2535',
            boxShadow: !marcha ? '0 0 6px var(--accent-red)' : 'none'
          }} />
          <span className={styles.sigName}>Coil 1</span>
          <span className={styles.sigLabel} style={{ color: !marcha ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
            PARO {!marcha ? '▲1' : '▼0'}
          </span>
        </div>
        <div className={styles.signalRow}>
          <span className={styles.sigDot} style={{ background: 'var(--accent-amber)', opacity: 0.8 }} />
          <span className={styles.sigName}>HR 0</span>
          <span className={styles.sigLabel} style={{ color: 'var(--accent-amber)' }}>
            VEL {Math.round(velocidad).toString().padStart(3, '0')}
          </span>
        </div>
      </div>

      {!connected && (
        <div className={styles.offline}>
          ⚡ Conecta al PLC para controlar
        </div>
      )}
    </div>
  )
}
