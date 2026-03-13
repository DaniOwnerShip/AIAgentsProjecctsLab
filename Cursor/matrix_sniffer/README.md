# Matrix Sniffer (Windows)

Aplicación de consola que muestra un efecto Matrix en tiempo real a partir de **paquetes reales** de red.

![mcc](https://github.com/user-attachments/assets/f2c42c47-300d-4242-be00-f559a7121b22)

## Requisitos

- **Windows 10 / 11**.
- **Python 3.9+** instalado y en el PATH.
- Consola que soporte códigos ANSI (la consola moderna de Windows ya lo hace).
- Para captura real de paquetes:
  - Ejecutar la consola **como Administrador**.
  - Tener instalado **Npcap** (o WinPcap compatible), por ejemplo desde `https://npcap.com`.

Si no se cumplen estos requisitos de captura, **el programa no funcionará** (no hay modo simulado) y mostrará un mensaje de error.

## Instalación

1. Abre una consola (PowerShell o CMD) en la carpeta del proyecto:

   ```bash
   cd c:\Users\danio\Documents\cursorProjects\matrix_sniffer
   ```

2. (Opcional pero recomendado) Crea y activa un entorno virtual:

   ```bash
   python -m venv venv
   .\venv\Scripts\activate
   ```

3. Instala dependencias:

   ```bash
   pip install -r requirements.txt
   ```

## Ejecución

1. Asegúrate de tener **Npcap** instalado.
2. Abre la consola **como Administrador** (requerido para capturar paquetes).

3. Ejecuta el programa:

   ```bash
   python main.py
   ```

## Controles

- **P**: Pausar / reanudar la animación (la imagen queda congelada).
- **Q**: Salir del programa.

## Notas

- Si Scapy no está disponible, o faltan permisos/drivers/permisos para captura, el programa mostrará un **mensaje de error** y terminará.
- El efecto Matrix:
  - Muestra columnas de caracteres verdes cayendo verticalmente.
  - La consola se redibuja en tiempo real.
  - **El contenido completo del paquete (cabeceras y campos interpretados por Scapy) se usa tal cual, sin sustituciones ni simulación**, como origen de caracteres para las columnas Matrix.

