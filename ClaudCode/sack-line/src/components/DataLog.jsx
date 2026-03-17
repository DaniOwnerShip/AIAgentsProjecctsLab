import React from 'react'

export function DataLog({ plcData, connected }) {
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
