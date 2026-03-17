import React, { useEffect, useRef, useState, memo } from 'react'

const W = 900
const H = 320
const BELT_Y = 200
const BELT_H = 28
const BELT_X1 = 120  // inicio (lado depósito)
const BELT_X2 = 760  // fin (extremo derecho)
const BELT_W = BELT_X2 - BELT_X1

const SACK_W = 52
const SACK_H = 38
const NUM_SACKS = 6
const SACK_SPACING = BELT_W / NUM_SACKS

// Radios de los tambores/poleas de la cinta
const PULLEY_R = 16

const SVG_DEFS = memo(() => (
  <defs>
    <linearGradient id="beltGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stopColor="#3a4e6a" />
      <stop offset="50%"  stopColor="#2a3a52" />
      <stop offset="100%" stopColor="#1a2838" />
    </linearGradient>
    <filter id="sackShadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="2" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.5" />
    </filter>
    <linearGradient id="depotGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"   stopColor="#1e4a7a" />
      <stop offset="100%" stopColor="#0d1f35" />
    </linearGradient>
    <radialGradient id="motorGrad" cx="50%" cy="40%" r="60%">
      <stop offset="0%"   stopColor="#2a5080" />
      <stop offset="100%" stopColor="#0e2040" />
    </radialGradient>
    <clipPath id="beltClip">
      <rect x={BELT_X1} y={BELT_Y - SACK_H - 2} width={BELT_W} height={SACK_H + BELT_H + 4} />
    </clipPath>
    <linearGradient id="sackGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stopColor="#d4b077" />
      <stop offset="60%"  stopColor="#c09050" />
      <stop offset="100%" stopColor="#8b6530" />
    </linearGradient>
  </defs>
))

export default function ProductionLine({ marcha, velocidad }) {
  const animRef  = useRef(null)
  const offsetRef = useRef(0)
  const [offset, setOffset] = useState(0)
  const [motorAngle, setMotorAngle] = useState(0)

  // Velocidad: 0-100 → píxeles/frame
  const speed = marcha ? (velocidad / 100) * 2.8 : 0

  useEffect(() => {
    let last = performance.now()

    const tick = (now) => {
      const dt = now - last
      last = now

      if (speed > 0) {
        offsetRef.current = (offsetRef.current + speed * (dt / 16)) % SACK_SPACING
        setOffset(offsetRef.current)
        setMotorAngle(a => (a + speed * (dt / 16) * 3) % 360)
      }

      animRef.current = requestAnimationFrame(tick)
    }

    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [speed])

  // Generar sacos sobre la cinta
  const sacks = Array.from({ length: NUM_SACKS + 2 }, (_, i) => {
    const baseX = BELT_X1 + i * SACK_SPACING - offset
    // Filtrar los que están fuera del rango visible
    if (baseX + SACK_W < BELT_X1 - 10 || baseX > BELT_X2 + 10) return null
    return { id: i, x: baseX }
  }).filter(Boolean)

  const isRunning = marcha && speed > 0

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ display: 'block', overflow: 'visible' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <SVG_DEFS />

      {/* Dynamic belt stripe pattern */}
      <defs>
        <pattern id="beltStripe" x="0" y="0" width="32" height={BELT_H} patternUnits="userSpaceOnUse"
          patternTransform={`translate(${offset * 0.8},0)`}>
          <rect width="32" height={BELT_H} fill="url(#beltGrad)" />
          <rect x="0" width="2" height={BELT_H} fill="rgba(0,0,0,0.35)" />
          <rect x="16" width="2" height={BELT_H} fill="rgba(0,0,0,0.20)" />
        </pattern>
      </defs>

      {/* ── FONDO SUELO ──────────────────────────────────────────────────── */}
      <line x1="60" y1={BELT_Y + BELT_H + PULLEY_R + 2}
            x2={W - 60} y2={BELT_Y + BELT_H + PULLEY_R + 2}
            stroke="#1f2d42" strokeWidth="2" />

      {/* ─── DEPÓSITO (izquierda) ─────────────────────────────────────────── */}
      <g>
        {/* Cuerpo del depósito */}
        <rect x="20" y="80" width="80" height="120" rx="4"
              fill="url(#depotGrad)" stroke="#29b6f6" strokeWidth="1.5" />
        {/* Líneas de nivel */}
        <line x1="28" y1="110" x2="92" y2="110" stroke="#29b6f6" strokeWidth="0.8" strokeDasharray="4 3" opacity="0.5" />
        <line x1="28" y1="130" x2="92" y2="130" stroke="#29b6f6" strokeWidth="0.8" strokeDasharray="4 3" opacity="0.5" />
        <line x1="28" y1="150" x2="92" y2="150" stroke="#29b6f6" strokeWidth="0.8" strokeDasharray="4 3" opacity="0.5" />
        {/* Indicador nivel */}
        <rect x="28" y="115" width="44" height="70" rx="2" fill="#1a4060" stroke="none" opacity="0.6" />
        <rect x="28" y="118" width="44" height="64"
              fill={isRunning ? '#1a6090' : '#1a4060'}
              rx="2" opacity="0.8">
          {isRunning && (
            <animate attributeName="height" values="64;52;64" dur="2s" repeatCount="indefinite" />
          )}
        </rect>
        {/* Tapa */}
        <rect x="16" y="74" width="88" height="12" rx="3"
              fill="#1e3a5a" stroke="#29b6f6" strokeWidth="1.5" />
        {/* Boca de salida → hacia la cinta */}
        <rect x="80" y="185" width="44" height="22" rx="2"
              fill="#1a2e45" stroke="#29b6f6" strokeWidth="1" />
        {/* Etiqueta */}
        <text x="60" y="230" textAnchor="middle" fill="#7b8fa6"
              fontSize="10" fontFamily="var(--font-mono)">DEPÓSITO</text>
      </g>

      {/* ─── TAMBOR IZQUIERDO (lado depósito) ────────────────────────────── */}
      <circle cx={BELT_X1} cy={BELT_Y + BELT_H / 2} r={PULLEY_R}
              fill="#1e3040" stroke="#3a5070" strokeWidth="2" />
      <circle cx={BELT_X1} cy={BELT_Y + BELT_H / 2} r={PULLEY_R - 5}
              fill="none" stroke="#2a4560" strokeWidth="1" />

      {/* ─── CINTA TRANSPORTADORA ────────────────────────────────────────── */}
      {/* Borde superior */}
      <rect x={BELT_X1} y={BELT_Y - 3} width={BELT_W} height={3}
            fill="#1a2535" stroke="#2a3a50" strokeWidth="0.5" />
      {/* Superficie cinta (con rayas animadas) */}
      <rect x={BELT_X1} y={BELT_Y} width={BELT_W} height={BELT_H}
            fill="url(#beltStripe)" />
      {/* Borde inferior */}
      <rect x={BELT_X1} y={BELT_Y + BELT_H} width={BELT_W} height={3}
            fill="#1a2535" stroke="#2a3a50" strokeWidth="0.5" />
      {/* Brillo superior de la cinta */}
      <rect x={BELT_X1} y={BELT_Y} width={BELT_W} height={4}
            fill="rgba(255,255,255,0.04)" />

      {/* Estructura soporte cinta (patas) */}
      {[200, 340, 480, 620].map(px => (
        <g key={px}>
          <rect x={px - 4} y={BELT_Y + BELT_H + 3} width={8} height={30}
                fill="#151f2e" stroke="#1f2d3e" strokeWidth="1" />
          <rect x={px - 12} y={BELT_Y + BELT_H + 30} width={24} height={5} rx="1"
                fill="#1a2535" />
        </g>
      ))}

      {/* ─── SACOS sobre la cinta ────────────────────────────────────────── */}
      <g clipPath="url(#beltClip)">
        {sacks.map(({ id, x }) => (
          <Sack key={id} x={x} y={BELT_Y - SACK_H} />
        ))}
      </g>

      {/* ─── MOTOR (derecha, mueve la cinta) ─────────────────────────────── */}
      <g transform={`translate(${BELT_X2 + 16}, ${BELT_Y - 10})`}>
        {/* Cuerpo motor */}
        <rect x="0" y="0" width="70" height="56" rx="6"
              fill="url(#motorGrad)" stroke="#29b6f6" strokeWidth="1.5" />
        {/* Rejilla ventilación */}
        {[8, 16, 24, 32, 40, 48].map(xx => (
          <line key={xx} x1={xx} y1="6" x2={xx} y2="50"
                stroke="#1a3a5a" strokeWidth="1.5" />
        ))}
        {/* Eje del motor */}
        <circle cx="-14" cy="28" r={PULLEY_R + 1}
                fill="#0e2535" stroke="#29b6f6" strokeWidth="2" />
        {/* Cruceta del eje (gira) */}
        <g transform={`rotate(${motorAngle}, ${-14}, 28)`}>
          <line x1={-14} y1={28 - PULLEY_R + 2} x2={-14} y2={28 + PULLEY_R - 2}
                stroke="#29b6f6" strokeWidth="2" />
          <line x1={-14 - PULLEY_R + 2} y1={28} x2={-14 + PULLEY_R - 2} y2={28}
                stroke="#29b6f6" strokeWidth="2" />
        </g>
        {/* LED estado */}
        <circle cx="58" cy="10" r="5"
                fill={isRunning ? 'var(--accent-green)' : '#1a2838'}
                stroke={isRunning ? 'var(--accent-green)' : '#2a4060'}
                strokeWidth="1">
          {isRunning && (
            <animate attributeName="opacity" values="1;0.4;1" dur="1.2s" repeatCount="indefinite" />
          )}
        </circle>
        {/* Placa */}
        <rect x="8" y="36" width="44" height="14" rx="2" fill="#0a1828" />
        <text x="30" y="47" textAnchor="middle" fill="#29b6f6"
              fontSize="7" fontFamily="var(--font-mono)">MOTOR</text>
        {/* Etiqueta velocidad sobre motor */}
        <text x="35" y="-8" textAnchor="middle" fill="#7b8fa6"
              fontSize="9" fontFamily="var(--font-mono)">
          {Math.round(velocidad)}%
        </text>
      </g>

      {/* ─── TAMBOR DERECHO ──────────────────────────────────────────────── */}
      <circle cx={BELT_X2} cy={BELT_Y + BELT_H / 2} r={PULLEY_R}
              fill="#1e3040" stroke="#3a5070" strokeWidth="2" />
      <circle cx={BELT_X2} cy={BELT_Y + BELT_H / 2} r={PULLEY_R - 5}
              fill="none" stroke="#2a4560" strokeWidth="1" />

      {/* ─── INDICADOR DE ESTADO DE LÍNEA ────────────────────────────────── */}
      <g transform={`translate(${W / 2}, 30)`}>
        <rect x="-80" y="-16" width="160" height="28" rx="4"
              fill="#0d1520" stroke={isRunning ? '#00e676' : '#ffab00'} strokeWidth="1.5" />
        <circle cx="-62" cy="0" r="5"
                fill={isRunning ? '#00e676' : '#ffab00'}>
          {isRunning && (
            <animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite" />
          )}
        </circle>
        <text x="-48" y="5" fill={isRunning ? '#00e676' : '#ffab00'}
              fontSize="12" fontFamily="var(--font-mono)" fontWeight="bold">
          {isRunning ? 'EN MARCHA' : marcha ? 'ACELERANDO' : 'PARADO'}
        </text>
      </g>

      {/* ─── FLECHAS DIRECCIÓN (aparecen cuando corre) ───────────────────── */}
      {isRunning && [250, 400, 550].map(ax => (
        <g key={ax} opacity="0.5">
          <animate
            attributeName="opacity"
            values="0;0.6;0"
            dur="1.5s"
            begin={`${ax / 500}s`}
            repeatCount="indefinite"
          />
          <polygon
            points={`${ax},${BELT_Y + BELT_H + 14} ${ax + 10},${BELT_Y + BELT_H + 19} ${ax},${BELT_Y + BELT_H + 24}`}
            fill="#29b6f6"
          />
        </g>
      ))}
    </svg>
  )
}

// ─── Saco individual ─────────────────────────────────────────────────────────
function Sack({ x, y }) {
  return (
    <g filter="url(#sackShadow)">
      {/* Cuerpo saco */}
      <path
        d={`
          M ${x + 4},${y + SACK_H}
          Q ${x},${y + SACK_H - 4} ${x + 2},${y + SACK_H / 2}
          Q ${x - 2},${y + 4} ${x + SACK_W / 2},${y}
          Q ${x + SACK_W + 2},${y + 4} ${x + SACK_W - 2},${y + SACK_H / 2}
          Q ${x + SACK_W},${y + SACK_H - 4} ${x + SACK_W - 4},${y + SACK_H}
          Z
        `}
        fill="url(#sackGrad)"
        stroke="#7a5020"
        strokeWidth="1"
      />
      {/* Costura central horizontal */}
      <line
        x1={x + 8} y1={y + SACK_H / 2}
        x2={x + SACK_W - 8} y2={y + SACK_H / 2}
        stroke="#8b6030" strokeWidth="1" strokeDasharray="3 2" opacity="0.7"
      />
      {/* Ligadura superior */}
      <ellipse
        cx={x + SACK_W / 2} cy={y + 4}
        rx="8" ry="4"
        fill="#8b6030" stroke="#6a4820" strokeWidth="0.8"
      />
      {/* Sombreado lateral */}
      <path
        d={`M ${x + SACK_W - 6},${y + 4} Q ${x + SACK_W + 2},${y + SACK_H / 2} ${x + SACK_W - 4},${y + SACK_H}`}
        fill="none" stroke="#7a5010" strokeWidth="3" opacity="0.3"
      />
    </g>
  )
}
