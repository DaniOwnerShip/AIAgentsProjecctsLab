# 📟 Matrix Network Scanner (Win11 Edition)

Una herramienta de monitoreo de red en tiempo real inspirada en la estética de **The Matrix**. Captura tráfico real de tu tarjeta de red y lo visualiza como una lluvia de código dinámico, detectando eventos clave en el flujo de datos.



## 🚀 Características
- **Captura Real:** Utiliza Scapy + Npcap para interceptar paquetes (TCP, UDP, DNS, ARP, ICMP).
- **Modos de Operación:** - `[SCAPY]`: Modo nativo de alta precisión (requiere Npcap).
  - `[RAW]`: Captura directa mediante sockets de Windows (limitado).
  - `[DEMO]`: Simulación visual si no hay permisos de administrador.
- **Detector de Intrusos:** Resalta y subraya automáticamente IPs externas (fuera del rango local 192.168.x.x, etc.).
- **Resaltado DNS:** Las consultas a dominios y tráfico de Google brillan en verde lima para facilitar su lectura.
- **Interfaz Interactiva:** HUD con estadísticas de paquetes, velocidad de caída y contador de IPs únicas.

## 🛠️ Requisitos
1. **Npcap:** [Descargar desde npcap.com](https://npcap.com/#download).
   * **CRÍTICO:** Durante la instalación, activa la casilla: *"Install Npcap in WinPcap API-compatible Mode"*.
2. **Python 3.10+**
3. **Dependencias:**
   ```powershell
   pip install scapy windows-curses

📋 Uso

Para que el escáner pueda acceder a la tarjeta de red, debes ejecutar la terminal como Administrador:
PowerShell

python matrix_sniffer.py

Controles en vivo:

    [ESPACIO] - Pausar/Reanudar el flujo de datos.

    [TAB]     - Cambiar filtros (Ver solo DNS, TCP, HTTP, etc.).

    [+] / [-] - Ajustar la velocidad de la caída.

    [C]       - Limpiar la pantalla de rastros.

    [S]       - Detener/Arrancar el sniffer.

    [Q]       - Desconectarse de la Matrix (Salir).

Nota: Este software es para fines educativos y de monitoreo personal. Úsalo con responsabilidad.
