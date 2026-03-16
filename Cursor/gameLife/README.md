## Juego de la Vida de Conway (Proyecto HTML/JS)

Este proyecto implementa el **Juego de la Vida de Conway** con una interfaz visual en el navegador.

![gl](https://github.com/user-attachments/assets/b96f64ce-bfdd-4ea9-ae75-2e29c37637ae)

### Características

- **Cuadrícula interactiva**: haz clic en las celdas para activarlas o desactivarlas.
- **Controles**:
  - **Iniciar**: comienza la simulación.
  - **Pausar**: detiene la evolución, permitiendo editar el patrón.
  - **Reiniciar**: limpia por completo la cuadrícula.
  - **Velocidad (FPS)**: deslizador para ajustar la velocidad de la simulación.
- Aplicación de las reglas clásicas del Juego de la Vida:
  - Una célula viva con 2 o 3 vecinas vivas sobrevive.
  - Una célula muerta con exactamente 3 vecinas vivas nace.
  - En cualquier otro caso, la célula muere o permanece muerta.

### Estructura del proyecto

- `index.html`: estructura principal de la página y contenedores.
- `styles.css`: estilos y diseño visual.
- `script.js`: lógica del juego y manejo de eventos.
- `package.json`: archivo de dependencias (opcional, sólo si quieres usar un servidor local).

### Cómo ejecutar el proyecto

La forma más simple:

- Abre el archivo `index.html` directamente en tu navegador (doble clic o abrir con tu navegador preferido).

Opcionalmente, si quieres usar un servidor local:

1. Asegúrate de tener **Node.js** instalado.
2. En una terminal, dentro de la carpeta del proyecto:

   ```bash
   npm install
   npx live-server
   ```

3. Se abrirá el navegador apuntando a la URL local donde se sirve el proyecto.

### Uso básico

1. Con la simulación **pausada**, haz clic sobre las celdas para definir el patrón inicial.
2. Pulsa **Iniciar** para comenzar la evolución.
3. Usa **Pausar** para detener la simulación y modificar manualmente el patrón.
4. Pulsa **Reiniciar** para limpiar toda la cuadrícula.
5. Ajusta la velocidad con el deslizador de FPS según tus preferencias.

