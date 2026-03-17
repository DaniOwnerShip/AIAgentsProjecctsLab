# SackLine Monitor

Aplicación SCADA para monitorización y control de línea de producción de sacos.  
**Stack**: Electron 32 · React 18 · Vite 5 · modbus-serial 8

---

## Instalación y arranque

```bash
# Instalar dependencias
npm install

# Modo desarrollo (Vite + Electron en paralelo)
npm run dev

# Compilar para distribución
npm run build
```

> **Nota:** En modo browser puro (sin Electron) la app arranca con datos **simulados**,
> lo que permite desarrollar la UI sin necesidad de un PLC físico.

---

## Mapa de direcciones Modbus

| Elemento | Tipo           | Dirección | Valores         |
|----------|----------------|-----------|-----------------|
| Marcha   | Coil (bit)     | 0         | 0=Parado / 1=En marcha |
| Paro     | Coil (bit)     | 1         | 0=OK / 1=Parado |
| Velocidad| Holding Reg.   | 0         | 0-100 (%)       |

> Ajusta las direcciones en `electron/main.cjs` si tu PLC usa un mapa diferente.

---

## Configuración de red

En el panel **Conexión** (sidebar derecho):

| Parámetro | Valor por defecto | Descripción            |
|-----------|-------------------|------------------------|
| IP PLC    | 192.168.1.10      | IP del PLC en la red   |
| Puerto    | 502               | Puerto Modbus estándar |
| Unit ID   | 1                 | ID esclavo Modbus      |

---

## Estructura del proyecto

```
sack-line/
├── electron/
│   ├── main.cjs        ← Proceso principal Electron + Modbus IPC
│   └── preload.cjs     ← Bridge seguro renderer ↔ main
├── src/
│   ├── hooks/
│   │   └── useModbus.js         ← Hook React: conexión, polling, escritura
│   ├── components/
│   │   ├── ProductionLine.jsx   ← Visualización SVG animada
│   │   ├── ControlPanel.jsx     ← Marcha/Paro + Velocidad
│   │   └── ConnectionPanel.jsx  ← Config Modbus TCP/IP
│   ├── App.jsx          ← Layout principal
│   └── index.css        ← Variables CSS + tema industrial
├── index.html
├── vite.config.js
└── package.json
```

---

## Personalización

### Cambiar número de sacos o espaciado
Edita en `src/components/ProductionLine.jsx`:
```js
const NUM_SACKS = 6        // Sacos visibles simultáneamente
const SACK_SPACING = ...   // Separación automática
```

### Añadir más señales Modbus
1. Lee más coils/registros en `electron/main.cjs` → función del polling
2. Envíalos en el objeto `modbus:data`
3. Úsalos en `useModbus.js` → estado `plcData`

### Cambiar el rango de velocidad
Si tu PLC envía valores en Hz (0-50 Hz) en lugar de porcentaje, adapta la escala:
```js
// En ProductionLine.jsx
const speed = marcha ? (velocidad / 50) * 2.8 : 0  // 50 Hz = velocidad máxima
```
