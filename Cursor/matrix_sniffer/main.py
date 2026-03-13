import os
import sys
import time
import random
import threading
import queue
import shutil

try:
    import msvcrt  # type: ignore
except ImportError:
    msvcrt = None  # type: ignore

try:
    from colorama import init as colorama_init
except ImportError:
    colorama_init = None  # type: ignore

from scapy.all import sniff, conf  # type: ignore


class PacketMatrix:
    def __init__(self) -> None:
        self.packet_queue: "queue.Queue[str]" = queue.Queue(maxsize=2000)
        self.stop_event = threading.Event()
        self.paused = False
        self.lock = threading.Lock()
        self.packet_count = 0

        # Desactivar cualquier salida verbose de Scapy en consola
        # para evitar que escriba líneas propias (CRLF) por cada paquete.
        conf.verb = 0

        if colorama_init is not None:
            colorama_init()

    def start(self) -> None:
        os.system("")  # enable ANSI on Windows 10+
        self._hide_cursor()
        self._clear_screen()

        sniffer_thread = threading.Thread(target=self._run_sniffer, daemon=True)
        sniffer_thread.start()

        try:
            self._run_matrix()
        finally:
            self.stop_event.set()
            sniffer_thread.join(timeout=1.0)
            self._show_cursor()
            self._reset_colors()
            print("\nFinalizado.")

    # -------------------- Sniffer --------------------

    def _run_sniffer(self) -> None:
        def on_packet(pkt) -> None:  # type: ignore[no-untyped-def]
            if self.stop_event.is_set():
                return
            try:
                # Usamos el volcado completo del paquete (cabeceras + payload)
                # para que toda la información se convierta en caracteres.
                text = pkt.show(dump=True)  # type: ignore[no-untyped-call]
                self._enqueue_packet(text)
            except Exception:
                # No interrumpir el efecto por errores puntuales.
                pass

        try:
            sniff(
                prn=on_packet,
                store=False,
                stop_filter=lambda _: self.stop_event.is_set(),
            )
        except PermissionError:
            # Sin privilegios no hay modo simulado: terminamos con mensaje claro.
            self.stop_event.set()
            self._show_cursor()
            self._reset_colors()
            print(
                "\n[ERROR] Permiso denegado al capturar paquetes.\n"
                "Ejecuta la consola como Administrador."
            )
        except OSError as e:
            # Problemas de driver (Npcap ausente, etc.): también terminamos.
            self.stop_event.set()
            self._show_cursor()
            self._reset_colors()
            print(
                "\n[ERROR] No se pudo iniciar la captura de paquetes.\n"
                "Asegúrate de tener Npcap instalado y funcionando.\n"
                f"Detalle: {e}"
            )

    def _enqueue_packet(self, text: str) -> None:
        try:
            self.packet_queue.put_nowait(text)
            self.packet_count += 1
        except queue.Full:
            # Si la cola está llena, descartamos el paquete más antiguo.
            try:
                _ = self.packet_queue.get_nowait()
            except queue.Empty:
                pass
            try:
                self.packet_queue.put_nowait(text)
            except queue.Full:
                pass

    # -------------------- Matrix rendering --------------------

    def _run_matrix(self) -> None:
        width, height = shutil.get_terminal_size(fallback=(80, 24))
        # Usamos como máximo el ancho de la consola para no provocar scroll.
        num_cols = max(1, width)
        streams = self._create_streams(num_cols, height)

        last_resize_check = time.time()

        while not self.stop_event.is_set():
            now = time.time()

            # Recalcular tamaño de terminal cada cierto tiempo.
            if now - last_resize_check > 1.0:
                width, height = shutil.get_terminal_size(fallback=(80, 24))
                num_cols = max(1, width)
                if num_cols != len(streams):
                    streams = self._create_streams(num_cols, height)
                last_resize_check = now

            self._handle_keyboard()

            if not self.paused:
                self._drain_new_packets_into_streams(streams)
                self._step_streams(streams, height)
                self._draw(streams, width, height)
            else:
                self._draw_pause_overlay(width, height)

            time.sleep(0.05)

    def _create_streams(self, num_cols: int, height: int):
        streams = []
        for x in range(num_cols):
            stream = {
                "x": x,
                "y": random.randint(-height, 0),
                "speed": random.randint(1, 2),
                "chars": [],
                "active": False,
            }
            streams.append(stream)
        return streams

    def _drain_new_packets_into_streams(self, streams) -> None:
        try:
            for _ in range(20):
                text = self.packet_queue.get_nowait()
                col = random.choice(streams)
                # Usamos el texto REAL del paquete, sin modificarlo.
                chars = self._packet_text_to_chars(text)
                col["chars"] = chars
                col["y"] = -len(chars)
                col["speed"] = random.randint(1, 2)
                col["active"] = True
        except queue.Empty:
            pass

    def _packet_text_to_chars(self, text: str):
        """
        Convertimos el texto del paquete en una lista de caracteres **visibles**.

        Para evitar que la consola se descontrole, simplemente
        ignoramos caracteres de control (como saltos de línea, tabuladores, etc.),
        pero todos los caracteres imprimibles se conservan tal cual.
        """
        chars = []
        for ch in text:
            # `isprintable` ya descarta la mayoría de controles; filtramos
            # explícitamente saltos de línea y tabulaciones para que no rompan filas.
            if ch in ("\n", "\r", "\t"):
                continue
            if ch.isprintable():
                chars.append(ch)
        return chars

    def _step_streams(self, streams, height: int) -> None:
        for stream in streams:
            if not stream["active"]:
                continue

            stream["y"] += stream["speed"]
            if stream["y"] - len(stream["chars"]) > height:
                stream["active"] = False

    def _draw(self, streams, width: int, height: int) -> None:
        # No limpiamos la pantalla completa en cada frame para evitar
        # que la consola se "llene" con líneas nuevas; solo movemos el
        # cursor y escribimos en posiciones concretas.
        green = "\x1b[32m"
        bright_green = "\x1b[92m"
        dim_green = "\x1b[2;32m"

        for stream in streams:
            if not stream["active"]:
                continue
            x = stream["x"]
            chars = stream["chars"]
            y_head = stream["y"]

            for i, ch in enumerate(chars):
                y = y_head - i
                if y < 0 or y >= height:
                    continue

                if i == 0:
                    color = bright_green
                elif i < len(chars) // 2:
                    color = green
                else:
                    color = dim_green

                self._move_cursor(y + 1, x + 1)
                sys.stdout.write(f"{color}{ch}\x1b[0m")

        sys.stdout.flush()

    def _draw_pause_overlay(self, width: int, height: int) -> None:
        # No limpiamos todo para que se mantenga la imagen congelada,
        # solo escribimos un mensaje encima.
        msg = "[P] Reanudar  |  [Q] Salir"
        row = max(1, height // 2)
        col = max(1, (width - len(msg)) // 2)
        self._move_cursor(row, col)
        sys.stdout.write("\x1b[7m" + msg + "\x1b[0m")
        sys.stdout.flush()

    # -------------------- Keyboard --------------------

    def _handle_keyboard(self) -> None:
        if msvcrt is None:
            return
        while msvcrt.kbhit():
            ch = msvcrt.getch()
            if ch in (b"q", b"Q"):
                self.stop_event.set()
                return
            if ch in (b"p", b"P"):
                with self.lock:
                    self.paused = not self.paused

    # -------------------- Console helpers --------------------

    def _clear_screen(self) -> None:
        sys.stdout.write("\x1b[2J\x1b[H")
        sys.stdout.flush()

    def _move_cursor(self, row: int, col: int) -> None:
        sys.stdout.write(f"\x1b[{row};{col}H")

    def _hide_cursor(self) -> None:
        sys.stdout.write("\x1b[?25l")
        sys.stdout.flush()

    def _show_cursor(self) -> None:
        sys.stdout.write("\x1b[?25h")
        sys.stdout.flush()

    def _reset_colors(self) -> None:
        sys.stdout.write("\x1b[0m")
        sys.stdout.flush()


def main() -> None:
    print("Iniciando Matrix Sniffer...")
    print("Teclas: [P] Pausar/Reanudar  |  [Q] Salir")
    time.sleep(1.0)
    matrix = PacketMatrix()
    matrix.start()


if __name__ == "__main__":
    main()

