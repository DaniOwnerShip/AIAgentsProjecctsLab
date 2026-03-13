// Implementación del Juego de la Vida de Conway en JavaScript puro.
// Este archivo contiene:
// - Representación de la cuadrícula
// - Lógica de evolución según las reglas
// - Manejo de eventos de los controles y del clic en las celdas

// Configuración básica de la cuadrícula
const ROWS = 40; // número de filas
const COLS = 40; // número de columnas

// Referencias a elementos del DOM
const gridElement = document.getElementById("grid");
const startBtn = document.getElementById("start-btn");
const pauseBtn = document.getElementById("pause-btn");
const resetBtn = document.getElementById("reset-btn");
const speedRange = document.getElementById("speed-range");
const speedDisplay = document.getElementById("speed-display");

// Matriz que representará el estado actual de cada celda (0 = muerta, 1 = viva)
let grid = createEmptyGrid();
// Variable auxiliar para almacenar el identificador del intervalo de simulación
let intervalId = null;
// Indica si la simulación está en curso
let isRunning = false;

// Inicializamos la interfaz
initializeGridUI();
updateSpeedLabel();

/**
 * Crea una matriz bidimensional inicializada con ceros.
 * Cada posición representa una celda muerta.
 */
function createEmptyGrid() {
  const arr = [];
  for (let row = 0; row < ROWS; row++) {
    const rowArr = [];
    for (let col = 0; col < COLS; col++) {
      rowArr.push(0);
    }
    arr.push(rowArr);
  }
  return arr;
}

/**
 * Dibuja la cuadrícula en el DOM creando un elemento "div" por cada celda.
 * También asigna el manejador de clic para permitir activar/desactivar celdas.
 */
function initializeGridUI() {
  // Definimos la forma de la cuadrícula CSS para que tenga ROWS x COLS celdas
  gridElement.style.gridTemplateRows = `repeat(${ROWS}, 1fr)`;
  gridElement.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;

  // Eliminamos cualquier contenido anterior por si se llama más de una vez
  gridElement.innerHTML = "";

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cellElement = document.createElement("div");
      cellElement.classList.add("cell");

      // Guardamos la posición de la celda en atributos dataset para recuperarla al hacer clic
      cellElement.dataset.row = row.toString();
      cellElement.dataset.col = col.toString();

      // Al hacer clic sobre una celda, alternamos su estado solo si la simulación está pausada
      cellElement.addEventListener("click", () => {
        if (isRunning) return; // Evitamos que se edite durante la ejecución
        toggleCell(row, col);
      });

      gridElement.appendChild(cellElement);
    }
  }

  // Sincronizamos la representación visual con la matriz inicial (todo vacío)
  renderGrid();
}

/**
 * Cambia el estado de una celda (muerta/viva) en la matriz y actualiza la vista.
 */
function toggleCell(row, col) {
  grid[row][col] = grid[row][col] === 1 ? 0 : 1;
  renderCell(row, col);
}

/**
 * Pinta la cuadrícula completa según el estado de la matriz `grid`.
 * Se utiliza al inicio o tras operaciones globales.
 */
function renderGrid() {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      renderCell(row, col);
    }
  }
}

/**
 * Actualiza el aspecto visual de una única celda.
 * Añade o quita la clase "alive" según su estado en la matriz.
 */
function renderCell(row, col) {
  const index = row * COLS + col;
  const cellElement = gridElement.children[index];
  if (!cellElement) return;

  if (grid[row][col] === 1) {
    cellElement.classList.add("alive");
  } else {
    cellElement.classList.remove("alive");
  }
}

/**
 * Calcula el siguiente estado de la cuadrícula aplicando las reglas del Juego de la Vida.
 * - Una célula viva con 2 o 3 vecinas vivas sobrevive.
 * - Una célula muerta con exactamente 3 vecinas vivas se convierte en viva.
 * - En cualquier otro caso, la célula muere o sigue muerta.
 */
function computeNextGeneration() {
  // Creamos una copia nueva donde almacenaremos el siguiente estado
  const nextGrid = createEmptyGrid();

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const neighbors = countAliveNeighbors(row, col);
      const currentState = grid[row][col];

      if (currentState === 1) {
        // Célula viva
        if (neighbors === 2 || neighbors === 3) {
          nextGrid[row][col] = 1; // Sobrevive
        } else {
          nextGrid[row][col] = 0; // Muere por soledad o sobrepoblación
        }
      } else {
        // Célula muerta
        if (neighbors === 3) {
          nextGrid[row][col] = 1; // Nace una nueva célula
        } else {
          nextGrid[row][col] = 0; // Permanece muerta
        }
      }
    }
  }

  // Reemplazamos la cuadrícula actual por la nueva
  grid = nextGrid;
  renderGrid();
}

/**
 * Cuenta cuántas celdas vecinas vivas tiene una posición dada.
 * Se consideran las 8 posiciones adyacentes (horizontal, vertical y diagonal).
 */
function countAliveNeighbors(row, col) {
  let count = 0;

  for (let dRow = -1; dRow <= 1; dRow++) {
    for (let dCol = -1; dCol <= 1; dCol++) {
      if (dRow === 0 && dCol === 0) continue; // Saltamos la propia celda

      const neighborRow = row + dRow;
      const neighborCol = col + dCol;

      // Comprobamos que el vecino está dentro de los límites de la cuadrícula
      if (
        neighborRow >= 0 &&
        neighborRow < ROWS &&
        neighborCol >= 0 &&
        neighborCol < COLS
      ) {
        count += grid[neighborRow][neighborCol];
      }
    }
  }

  return count;
}

/**
 * Inicia la simulación si no está ya en marcha.
 */
function startSimulation() {
  if (isRunning) return;
  isRunning = true;
  updateButtonsState();

  // Calculamos el intervalo en milisegundos a partir de los FPS seleccionados
  const fps = parseInt(speedRange.value, 10);
  const intervalMs = 1000 / fps;

  // Ejecutamos computeNextGeneration periódicamente
  intervalId = setInterval(() => {
    computeNextGeneration();
  }, intervalMs);
}

/**
 * Pausa la simulación si está en marcha.
 */
function pauseSimulation() {
  if (!isRunning) return;
  isRunning = false;
  updateButtonsState();

  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/**
 * Detiene la simulación y limpia la cuadrícula.
 */
function resetSimulation() {
  pauseSimulation();
  grid = createEmptyGrid();
  renderGrid();
}

/**
 * Habilita o deshabilita los botones según el estado actual.
 */
function updateButtonsState() {
  if (isRunning) {
    startBtn.disabled = true;
    pauseBtn.disabled = false;
  } else {
    startBtn.disabled = false;
    pauseBtn.disabled = true;
  }
}

/**
 * Actualiza la etiqueta numérica que muestra la velocidad actual (FPS).
 */
function updateSpeedLabel() {
  speedDisplay.textContent = speedRange.value;
}

/**
 * Actualiza la velocidad de la simulación cuando el usuario mueve el control.
 * Si la simulación está en marcha, reiniciamos el intervalo con la nueva velocidad.
 */
function handleSpeedChange() {
  updateSpeedLabel();

  if (isRunning) {
    // Reiniciamos la simulación para aplicar la nueva velocidad
    pauseSimulation();
    startSimulation();
  }
}

// Asociamos los controladores de eventos a los botones y controles
startBtn.addEventListener("click", startSimulation);
pauseBtn.addEventListener("click", pauseSimulation);
resetBtn.addEventListener("click", resetSimulation);
speedRange.addEventListener("input", handleSpeedChange);

