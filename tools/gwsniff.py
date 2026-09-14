#!/usr/bin/env python3
"""Мини-«сетевой сервер» Semtech UDP для проверки меток времени.

Принимает PUSH_DATA от пакет-форвардера, подтверждает их и печатает по
каждому принятому кадру:

    time   — UTC-время приёма (есть, когда форвардер захватил GPS);
    tmms   — GPS-время в мс от начала эпохи GPS (06.01.1980) — главный признак
             того, что PPS-синхронизация концентратора работает;
    tmst   — «сырой» счётчик концентратора, мкс (есть всегда);
    ftime  — тонкая метка времени SX1303, нс (BW125, при fine_timestamp.enable).

Использование:
    python3 tools/gwsniff.py                  # слушать 0.0.0.0:1700
    python3 tools/gwsniff.py -p 1700 -v       # + печатать сырой JSON статистики

В global_conf.json при этом должен стоять server_address = 127.0.0.1.
"""

import argparse
import json
import socket
import struct
import sys
from datetime import datetime, timedelta, timezone

PUSH_DATA, PUSH_ACK, PULL_DATA, PULL_RESP, PULL_ACK, TX_ACK = 0, 1, 2, 3, 4, 5
GPS_EPOCH = datetime(1980, 1, 6, tzinfo=timezone.utc)


def gps_ms_to_utc(tmms: int) -> str:
    """GPS-время (мс) -> UTC. Секунды координации (18 с на 2026 г.) не вычитаются."""
    return (GPS_EPOCH + timedelta(milliseconds=tmms)).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3]


def fmt_pkt(pkt: dict) -> str:
    parts = [
        f"freq={pkt.get('freq'):<9}",
        f"{pkt.get('datr','?'):<9}",
        f"rssi={pkt.get('rssis', pkt.get('rssi')):>5}",
        f"snr={pkt.get('lsnr'):>5}",
        f"tmst={pkt.get('tmst')}",
    ]
    tmms = pkt.get("tmms")
    parts.append(f"tmms={tmms} ({gps_ms_to_utc(tmms)} GPS)" if tmms is not None else "tmms=—")
    ftime = pkt.get("ftime")
    parts.append(f"ftime={ftime} ns" if ftime is not None else "ftime=—")
    if pkt.get("time"):
        parts.append(f"time={pkt['time']}")
    return "  ".join(str(p) for p in parts)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("-b", "--bind", default="0.0.0.0")
    ap.add_argument("-p", "--port", type=int, default=1700)
    ap.add_argument("-v", "--verbose", action="store_true", help="печатать stat-кадры")
    args = ap.parse_args()

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind((args.bind, args.port))
    print(f"[*] слушаю {args.bind}:{args.port} — жду PUSH_DATA от шлюза", flush=True)

    total = with_tmms = with_ftime = 0
    try:
        while True:
            data, addr = sock.recvfrom(65535)
            if len(data) < 4:
                continue
            version, token, ident = data[0], data[1:3], data[3]

            if ident == PULL_DATA:
                sock.sendto(struct.pack("<B", version) + token + struct.pack("<B", PULL_ACK), addr)
                continue
            if ident == TX_ACK:
                continue
            if ident != PUSH_DATA or len(data) < 12:
                continue

            sock.sendto(struct.pack("<B", version) + token + struct.pack("<B", PUSH_ACK), addr)
            eui = data[4:12].hex().upper()
            try:
                payload = json.loads(data[12:].decode("utf-8", "replace"))
            except json.JSONDecodeError:
                continue

            for pkt in payload.get("rxpk", []):
                total += 1
                with_tmms += "tmms" in pkt
                with_ftime += "ftime" in pkt
                print(f"[{eui}] {fmt_pkt(pkt)}", flush=True)

            if "stat" in payload:
                stat = payload["stat"]
                gps = "GPS: —"
                if "lati" in stat and "long" in stat:
                    gps = f"GPS: {stat['lati']},{stat['long']} alt={stat.get('alti')}"
                print(f"[{eui}] stat  {stat.get('time','')}  rxnb={stat.get('rxnb')} "
                      f"rxok={stat.get('rxok')}  {gps}", flush=True)
                if args.verbose:
                    print("        " + json.dumps(stat, ensure_ascii=False), flush=True)
    except KeyboardInterrupt:
        print(f"\n[*] кадров: {total}, c tmms (GPS-время): {with_tmms}, "
              f"c ftime (тонкая метка): {with_ftime}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
