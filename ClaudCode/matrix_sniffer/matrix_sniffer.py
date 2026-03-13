#!/usr/bin/env python3
"""
MATRIX NETWORK SCANNER - Windows 11
Captura paquetes reales con scapy + Npcap.
Requiere:
  1. Npcap: https://npcap.com/#download  (marcar "WinPcap API-compatible mode")
  2. pip install scapy windows-curses

Ejecutar en PowerShell como Administrador:
  python matrix_sniffer.py
"""

import sys
import os
import time
import threading
import random
from collections import deque
from datetime import datetime

try:
    import curses
except ImportError:
    print("Instala windows-curses:  pip install windows-curses")
    sys.exit(1)

try:
    from scapy.all import sniff, IP, TCP, UDP, ICMP, DNS, ARP, Raw, get_if_list
    SCAPY_OK = True
except ImportError:
    SCAPY_OK = False

# ── Colores — todo verde, igual que la película ───────────────────────────────
C_BRIGHT = 1   # cabeza del stream (blanco)
C_MID    = 2   # cuerpo (verde)
C_DIM    = 3   # cola
C_FADE   = 4   # rastro final
C_HUD    = 5   # barra HUD
C_HUDW   = 6   # HUD blanco
C_LIME   = 7   # verde lima para IPs

# El texto tiene formato fijo:  PROTO  SRC_IP  ->  DST_IP  DETAIL
# Posiciones en el string:      0-4    7-21        26-40
IP_SRC_START = 7
IP_SRC_END   = 22
IP_DST_START = 26
IP_DST_END   = 41

STREAM_TTL = 10.0  # segundos visibles antes del fade
FADE_SECS  = 2.5   # duración del fade-out

PROTOCOLS = ["ALL", "TCP", "UDP", "DNS", "HTTP", "HTTPS", "ICMP", "ARP"]


# ── Stream: columna de datos cayendo ─────────────────────────────────────────
class Stream:
    def __init__(self, col, canvas_h, text, speed=1.0):
        self.col      = col
        self.canvas_h = canvas_h
        self.chars    = list(text) if text else [" "]
        self.y        = -random.randint(2, max(4, canvas_h // 3))
        self.speed    = speed
        self.length   = random.randint(10, min(38, canvas_h - 2))
        self.dead     = False
        self._acc     = 0.0
        self._last    = time.perf_counter()
        self.born     = time.perf_counter()
        self.dying    = False

    def update(self):
        now = time.perf_counter()
        self._acc += (now - self._last) * self.speed * 14
        self._last = now
        steps = int(self._acc)
        if steps:
            self.y   += steps
            self._acc -= steps
        age = time.perf_counter() - self.born
        if age > STREAM_TTL + FADE_SECS:
            self.dead = True
        elif age > STREAM_TTL:
            self.dying = True
        if self.y - self.length > self.canvas_h:
            self.dead = True

    def rows(self):
        head = int(self.y)
        age  = time.perf_counter() - self.born
        fade = max(0.0, min(1.0, (age - STREAM_TTL) / FADE_SECS)) if self.dying else 0.0
        out  = []
        for i in range(self.length):
            row = head - i
            if 0 <= row < self.canvas_h:
                ch = self.chars[i % len(self.chars)]
                if i == 0:
                    color = C_BRIGHT
                elif i <= 3:
                    color = C_MID
                elif i < self.length * 0.55:
                    color = C_MID
                elif i < self.length * 0.80:
                    color = C_DIM
                else:
                    color = C_FADE
                out.append((row, ch, color, fade))
        return out


# ── Cola thread-safe ──────────────────────────────────────────────────────────
class PacketQueue:
    def __init__(self):
        self._q          = deque(maxlen=600)
        self._lock       = threading.Lock()
        self.stats       = {p: 0 for p in PROTOCOLS}
        self.bytes_total = 0
        self.unique_ips  = set()

    def push(self, d):
        with self._lock:
            self._q.append(d)
            self.stats["ALL"] += 1
            p = d.get("proto", "")
            if p in self.stats:
                self.stats[p] += 1
            self.bytes_total += d.get("size", 0)
            self.unique_ips.update([d.get("src", ""), d.get("dst", "")])

    def pop(self):
        with self._lock:
            return self._q.popleft() if self._q else None


# ── Parser scapy ──────────────────────────────────────────────────────────────
def parse_packet(pkt):
    try:
        size = len(pkt)

        if ARP in pkt:
            src    = pkt[ARP].psrc
            dst    = pkt[ARP].pdst
            detail = f"Who has {dst}? Tell {src}"
            proto  = "ARP"

        elif IP in pkt:
            src = pkt[IP].src
            dst = pkt[IP].dst

            if TCP in pkt:
                sp, dp = pkt[TCP].sport, pkt[TCP].dport
                fl = pkt[TCP].flags
                fs = (("S" if fl & 2  else "") +
                      ("A" if fl & 16 else "") +
                      ("F" if fl & 1  else "") +
                      ("R" if fl & 4  else "") +
                      ("P" if fl & 8  else ""))
                if dp in (443, 8443) or sp in (443, 8443):
                    proto, detail = "HTTPS", f"TLS  :{sp}->:{dp} [{fs}]"
                elif dp in (80, 8080) or sp in (80, 8080):
                    proto  = "HTTP"
                    detail = f":{sp}->:{dp} [{fs}]"
                    if Raw in pkt:
                        try:
                            raw = pkt[Raw].load.decode("utf-8", "ignore").split("\r\n")[0][:55]
                            if any(m in raw for m in ["GET", "POST", "PUT", "DELETE", "HEAD"]):
                                detail = raw
                        except Exception:
                            pass
                else:
                    proto, detail = "TCP", f":{sp}->:{dp} [{fs}]"

            elif UDP in pkt:
                sp, dp = pkt[UDP].sport, pkt[UDP].dport
                if (dp == 53 or sp == 53) and DNS in pkt:
                    proto = "DNS"
                    try:
                        if pkt[DNS].qr == 0:
                            qn = pkt[DNS].qd.qname.decode("utf-8", "ignore").rstrip(".")
                            detail = f"Q: {qn}"
                        else:
                            detail = f"R: {pkt[DNS].ancount} ans"
                    except Exception:
                        detail = f"DNS :{sp}->:{dp}"
                else:
                    proto, detail = "UDP", f":{sp}->:{dp} len={size}"

            elif ICMP in pkt:
                proto  = "ICMP"
                detail = {0: "Echo Reply", 8: "Echo Request", 3: "Unreachable",
                          11: "TTL Exceeded", 5: "Redirect"}.get(pkt[ICMP].type,
                          f"t={pkt[ICMP].type}")
            else:
                proto, detail = "IP", f"proto={pkt[IP].proto}"
        else:
            return None

        # Formato fijo para que las IPs siempre estén en posiciones conocidas:
        # "PROTO  SRC_IP_PADDED -> DST_IP_PADDED  DETAIL"
        #  01234  789...        26 28...           43...
        text = f"{proto:5s}  {src:>15s} -> {dst:<15s}  {detail}"
        return {"proto": proto, "src": src, "dst": dst, "size": size, "text": text}
    except Exception:
        return None


# ── Hilo sniffer scapy ────────────────────────────────────────────────────────
def sniffer_thread(pq, iface, stop_ev):
    def cb(pkt):
        if stop_ev.is_set():
            return
        d = parse_packet(pkt)
        if d:
            pq.push(d)
    try:
        sniff(iface=iface, prn=cb, filter="ip or arp", store=False,
              stop_filter=lambda p: stop_ev.is_set())
    except Exception:
        pass


# ── Hilo raw socket (fallback sin Npcap) ──────────────────────────────────────
def raw_socket_thread(pq, stop_ev):
    import socket, struct

    def parse_raw(data):
        try:
            ihl       = (data[0] & 0x0F) * 4
            proto_num = data[9]
            src       = socket.inet_ntoa(data[12:16])
            dst       = socket.inet_ntoa(data[16:20])
            size      = len(data)
            payload   = data[ihl:]

            if proto_num == 6 and len(payload) >= 20:
                sp = struct.unpack("!H", payload[0:2])[0]
                dp = struct.unpack("!H", payload[2:4])[0]
                fl = payload[13]
                fs = (("S" if fl & 2  else "") +
                      ("A" if fl & 16 else "") +
                      ("F" if fl & 1  else "") +
                      ("R" if fl & 4  else "") +
                      ("P" if fl & 8  else ""))
                if dp in (443, 8443) or sp in (443, 8443):
                    proto, detail = "HTTPS", f"TLS  :{sp}->:{dp} [{fs}]"
                elif dp in (80, 8080) or sp in (80, 8080):
                    proto, detail = "HTTP", f":{sp}->:{dp} [{fs}]"
                else:
                    proto, detail = "TCP", f":{sp}->:{dp} [{fs}]"

            elif proto_num == 17 and len(payload) >= 8:
                sp = struct.unpack("!H", payload[0:2])[0]
                dp = struct.unpack("!H", payload[2:4])[0]
                if dp == 53 or sp == 53:
                    try:
                        dns = payload[8:]
                        qr  = (dns[2] >> 7) & 1
                        if qr == 0 and len(dns) > 12:
                            idx, labels = 12, []
                            while idx < len(dns) and dns[idx] != 0:
                                l = dns[idx]; idx += 1
                                labels.append(dns[idx:idx + l].decode("utf-8", "ignore"))
                                idx += l
                            detail = f"Q: {'.'.join(labels)}"
                        else:
                            detail = f"DNS R :{sp}->:{dp}"
                        proto = "DNS"
                    except Exception:
                        proto, detail = "DNS", f":{sp}->:{dp}"
                else:
                    proto, detail = "UDP", f":{sp}->:{dp} len={size}"

            elif proto_num == 1:
                t = payload[0] if payload else -1
                detail = {0: "Echo Reply", 8: "Echo Request",
                          3: "Unreachable", 11: "TTL Exceeded"}.get(t, f"t={t}")
                proto  = "ICMP"
            else:
                proto, detail = "IP", f"proto={proto_num}"

            text = f"{proto:5s}  {src:>15s} -> {dst:<15s}  {detail}"
            return {"proto": proto, "src": src, "dst": dst, "size": size, "text": text}
        except Exception:
            return None

    try:
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)
    except Exception:
        local_ip = "0.0.0.0"

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_RAW, socket.IPPROTO_IP)
        s.bind((local_ip, 0))
        s.setsockopt(socket.IPPROTO_IP, socket.IP_HDRINCL, 1)
        s.ioctl(socket.SIO_RCVALL, socket.RCVALL_ON)
        s.settimeout(1.0)
        while not stop_ev.is_set():
            try:
                data, _ = s.recvfrom(65535)
                d = parse_raw(data)
                if d:
                    pq.push(d)
            except socket.timeout:
                continue
            except Exception:
                break
        try:
            s.ioctl(socket.SIO_RCVALL, socket.RCVALL_OFF)
            s.close()
        except Exception:
            pass
    except Exception:
        pass


# ── Hilo demo ─────────────────────────────────────────────────────────────────
def demo_thread(pq, stop_ev):
    protos  = ["TCP", "UDP", "DNS", "HTTP", "HTTPS", "ICMP", "ARP"]
    weights = [28, 18, 16, 12, 12, 7, 7]
    domains = ["www.google.com", "api.cloudflare.com", "cdn.jsdelivr.net",
               "updates.microsoft.com", "ntp.pool.org", "s3.amazonaws.com",
               "edge.netflix.com", "github.com", "login.live.com", "teams.microsoft.com"]

    def rip(priv=False):
        if priv or random.random() < 0.4:
            return f"192.168.{random.randint(0,5)}.{random.randint(1,254)}"
        return (f"{random.randint(1,223)}.{random.randint(0,255)}"
                f".{random.randint(0,255)}.{random.randint(1,254)}")

    while not stop_ev.is_set():
        proto = random.choices(protos, weights)[0]
        src, dst = rip(True), rip()
        size = random.randint(42, 1500)
        sp   = random.randint(1024, 65535)
        if proto == "DNS":
            detail, dp = f"Q: {random.choice(domains)}", 53
        elif proto == "HTTP":
            detail, dp = random.choice(["GET /index.html", "POST /api/login",
                                        "GET /static/app.js"]), 80
        elif proto == "HTTPS":
            detail, dp = "TLS1.3 Application Data", 443
        elif proto == "ICMP":
            detail = random.choice(["Echo Request", "Echo Reply", "TTL Exceeded"])
            dp = 0
        elif proto == "ARP":
            detail, dst = f"Who has {dst}? Tell {src}", "255.255.255.255"
            dp = 0
        elif proto == "TCP":
            flags  = random.choice(["S", "SA", "A", "PA", "FA"])
            dp     = random.choice([22, 25, 110, 143, 3306, 5432, 8080, 3389])
            detail = f":{sp}->:{dp} [{flags}]"
        else:
            dp     = random.randint(1024, 65535)
            detail = f":{sp}->:{dp} len={size}"

        text = f"{proto:5s}  {src:>15s} -> {dst:<15s}  {detail}"
        pq.push({"proto": proto, "src": src, "dst": dst, "size": size, "text": text})
        time.sleep(random.uniform(0.012, 0.08))


# ── Renderer ──────────────────────────────────────────────────────────────────
class MatrixRenderer:
    def __init__(self, stdscr, pq, mode="DEMO"):
        self.scr     = stdscr
        self.pq      = pq
        self.mode    = mode
        self.streams = []
        self.paused  = False
        self.stopped = False
        self.fidx    = 0
        self.filt    = "ALL"
        self.speed   = 1.0
        self.pps     = 0
        self.cur_pps = 0
        self._pps_t  = time.perf_counter()
        self._setup()
        self._resize()

    def _setup(self):
        curses.start_color()
        curses.use_default_colors()
        curses.init_pair(C_BRIGHT, curses.COLOR_WHITE, -1)
        curses.init_pair(C_MID,    curses.COLOR_GREEN, -1)
        curses.init_pair(C_DIM,    curses.COLOR_GREEN, -1)
        curses.init_pair(C_FADE,   curses.COLOR_GREEN, -1)
        curses.init_pair(C_HUD,    curses.COLOR_GREEN, curses.COLOR_BLACK)
        curses.init_pair(C_HUDW,   curses.COLOR_WHITE, curses.COLOR_BLACK)
        try:
            curses.init_color(10, 600, 1000, 0)   # verde lima #99FF00
            curses.init_pair(C_LIME, 10, -1)
        except Exception:
            curses.init_pair(C_LIME, curses.COLOR_GREEN, -1)
        curses.curs_set(0)
        self.scr.nodelay(True)
        self.scr.timeout(16)

    def _resize(self):
        self.H, self.W = self.scr.getmaxyx()
        self.CY = 2
        self.CH = max(1, self.H - 2 - 3)

    def _hud_top(self):
        state = "PAUSA" if self.paused else ("STOP " if self.stopped else " RUN ")
        bar   = (f" {state} | {self.pq.stats['ALL']:>8,} pkts | "
                 f"{self.cur_pps:4d} pkt/s | "
                 f"{len(self.pq.unique_ips):4d} IPs | "
                 f"{self.pq.bytes_total // 1024:>7,} KB | "
                 f"{datetime.now().strftime('%H:%M:%S')} ")
        try:
            self.scr.attron(curses.color_pair(C_HUD) | curses.A_BOLD)
            self.scr.addstr(0, 0,
                f" ▓ MATRIX NET SCANNER [{self.mode}] ▓ ".ljust(self.W)[:self.W - 1])
            self.scr.attroff(curses.color_pair(C_HUD) | curses.A_BOLD)
            self.scr.attron(curses.color_pair(C_HUD))
            self.scr.addstr(1, 0, bar.ljust(self.W)[:self.W - 1])
            self.scr.attroff(curses.color_pair(C_HUD))
        except curses.error:
            pass

    def _hud_bot(self):
        fline = " FILTRO: " + " ".join(
            f"[{p}]" if p == self.filt else f" {p} " for p in PROTOCOLS)
        keys = (" [ESPACIO] pausa  [S] stop  [C] limpiar  "
                "[TAB] filtro  [+/-] velocidad  [Q] salir ")
        y0 = self.H - 3
        try:
            self.scr.attron(curses.color_pair(C_HUD))
            self.scr.addstr(y0,     0, fline.ljust(self.W)[:self.W - 1])
            self.scr.addstr(y0 + 1, 0, keys.ljust(self.W)[:self.W - 1])
            self.scr.attroff(curses.color_pair(C_HUD))
            self.scr.attron(curses.color_pair(C_HUDW) | curses.A_BOLD)
            self.scr.addstr(y0 + 2, 0,
                f" vel: {self.speed:.1f}x ".ljust(self.W)[:self.W - 1])
            self.scr.attroff(curses.color_pair(C_HUDW) | curses.A_BOLD)
        except curses.error:
            pass

    def _draw(self):
        for s in self.streams:
            s.update()
            for row, ch, color, fade in s.rows():
                y = self.CY + row
                x = s.col
                if not (self.CY <= y < self.CY + self.CH and 0 <= x < self.W - 1):
                    continue
                try:
                    # Colorear IPs en verde lima según posición fija en el texto
                    pos = x % max(1, len(s.chars))
                    if (IP_SRC_START <= pos < IP_SRC_END or
                            IP_DST_START <= pos < IP_DST_END):
                        if color in (C_MID, C_DIM):
                            color = C_LIME

                    attr = curses.color_pair(color)
                    if color == C_BRIGHT: attr |= curses.A_BOLD
                    if color == C_FADE:   attr |= curses.A_DIM
                    if color == C_LIME:   attr |= curses.A_BOLD

                    # Fade-out por TTL: disolver aleatoriamente
                    if fade > 0:
                        if random.random() < fade:
                            self.scr.addch(y, x, ' ')
                            continue
                        if fade > 0.5:
                            attr = curses.color_pair(C_FADE) | curses.A_DIM
                        else:
                            attr |= curses.A_DIM

                    self.scr.addch(y, x, ch, attr)
                except curses.error:
                    pass
        self.streams = [s for s in self.streams if not s.dead]

    def _fade_bg(self):
        for _ in range(8):
            y = random.randint(self.CY, self.CY + self.CH - 1)
            x = random.randint(0, self.W - 2)
            try:
                self.scr.addch(y, x, ' ')
            except curses.error:
                pass

    def _input(self):
        k = self.scr.getch()
        if k in (ord('q'), ord('Q')):
            return False
        elif k == ord(' '):
            self.paused = not self.paused
        elif k in (ord('s'), ord('S')):
            self.stopped = not self.stopped
            if not self.stopped:
                self.paused = False
        elif k in (ord('c'), ord('C')):
            self.streams.clear()
            self.scr.clear()
        elif k in (ord('+'), curses.KEY_UP):
            self.speed = min(5.0, round(self.speed + 0.2, 1))
        elif k in (ord('-'), curses.KEY_DOWN):
            self.speed = max(0.2, round(self.speed - 0.2, 1))
        elif k in (9, ord('\t')):
            self.fidx = (self.fidx + 1) % len(PROTOCOLS)
            self.filt = PROTOCOLS[self.fidx]
        elif k == curses.KEY_RESIZE:
            self._resize()
            self.scr.clear()
        return True

    def run(self):
        frame = 0
        while self._input():
            if not self.paused and not self.stopped:
                for _ in range(15):
                    d = self.pq.pop()
                    if not d:
                        break
                    if self.filt != "ALL" and d.get("proto", "") != self.filt:
                        continue
                    col = random.randint(0, max(1, self.W - 2))
                    spd = self.speed * random.uniform(0.4, 1.9)
                    self.streams.append(Stream(col, self.CH, d.get("text", ""), spd))
                    self.pps += 1
            now = time.perf_counter()
            if now - self._pps_t >= 1.0:
                self.cur_pps = self.pps
                self.pps     = 0
                self._pps_t  = now
            if frame % 3 == 0:
                self._fade_bg()
            self._draw()
            self._hud_top()
            self._hud_bot()
            self.scr.refresh()
            frame += 1


# ── Entry point ───────────────────────────────────────────────────────────────
def main(stdscr):
    pq = PacketQueue()
    stop_ev = threading.Event()
    mode = "DEMO"

    # Intento 1: scapy + Npcap (Optimizado para Windows)
    if SCAPY_OK:
        try:
            from scapy.all import conf
            # Forzamos a Scapy a refrescar interfaces
            iface = conf.iface 
            
            # Iniciamos el hilo de Scapy
            t = threading.Thread(target=sniffer_thread, 
                                 args=(pq, iface, stop_ev), daemon=True)
            t.start()
            
            # Esperamos un poco más para ver si captura algo real
            # Si navegas por internet mientras esto carga, mejor
            time.sleep(2.0) 
            
            if pq.stats["ALL"] > 0:
                mode = "SCAPY"
            else:
                # Si Scapy no capturó nada, intentamos forzarlo un poco más
                # antes de tirar la toalla
                if pq.stats["ALL"] == 0:
                     # Intentamos enviar un paquete falso para "despertar" al sniffer
                     pass 
        except Exception:
            pass

    # Intento 2: socket raw Windows (Si Scapy falló)
    if mode == "DEMO":
        try:
            import socket as _s
            # Verificación rápida de privilegios de Admin para RAW
            t_test = _s.socket(_s.AF_INET, _s.SOCK_RAW, _s.IPPROTO_IP)
            t_test.close()
            
            threading.Thread(target=raw_socket_thread, 
                             args=(pq, stop_ev), daemon=True).start()
            time.sleep(1.5)
            if pq.stats["ALL"] > 0:
                mode = "RAW"
        except Exception:
            pass

    # Fallback demo
    if mode == "DEMO":
        threading.Thread(target=demo_thread, 
                         args=(pq, stop_ev), daemon=True).start()

    renderer = MatrixRenderer(stdscr, pq, mode=mode)
    try:
        renderer.run()
    finally:
        stop_ev.set()


def run():
    if not SCAPY_OK:
        print("\n  scapy no está instalado.")
        print("  Ejecuta en PowerShell como Administrador:")
        print("    pip install scapy windows-curses")
        print()
        print("  Y descarga Npcap:")
        print("    https://npcap.com/#download")
        print("    -> marca 'WinPcap API-compatible mode'")
        print()
        print("  Iniciando en modo DEMO en 4 segundos...")
        time.sleep(4)
    os.system("")
    curses.wrapper(main)


if __name__ == "__main__":
    run()
