#!/usr/bin/env python3
"""Правка global_conf.json пакет-форвардера sx1302_hal под GPS-метки времени.

Файлы global_conf.json из состава HAL содержат комментарии в стиле C
(их допускает парсер parson), поэтому перед разбором они снимаются.
Результат записывается уже строгим JSON — он читается той же parson.

Что настраивается:
  * SX130x_conf.fine_timestamp  — тонкие метки времени (только SX1303);
  * gateway_conf.gps_tty_path   — UART с NMEA (включает GPS-поток форвардера);
  * gateway_conf.fake_gps       — выключается, если GPS настоящий;
  * адрес LNS, порты, Gateway EUI, опорные координаты.
"""

import argparse
import json
import shutil
import sys

SX130X_KEYS = ("SX130x_conf", "SX1302_conf", "SX1301_conf")


def strip_comments(text: str) -> str:
    """Убрать /* ... */ и // ... вне строковых литералов JSON."""
    out = []
    i, n = 0, len(text)
    in_str = False
    while i < n:
        ch = text[i]
        if in_str:
            out.append(ch)
            if ch == "\\" and i + 1 < n:      # экранированный символ
                out.append(text[i + 1])
                i += 2
                continue
            if ch == '"':
                in_str = False
            i += 1
            continue
        if ch == '"':
            in_str = True
            out.append(ch)
            i += 1
            continue
        if ch == "/" and i + 1 < n:
            nxt = text[i + 1]
            if nxt == "*":
                end = text.find("*/", i + 2)
                i = n if end == -1 else end + 2
                out.append(" ")
                continue
            if nxt == "/":
                end = text.find("\n", i + 2)
                i = n if end == -1 else end
                continue
        out.append(ch)
        i += 1
    return "".join(out)


def find_section(cfg: dict, names) -> str:
    for name in names:
        if name in cfg:
            return name
    raise SystemExit("[x] в конфигурации нет секции " + " / ".join(names))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file", help="путь к global_conf.json")
    ap.add_argument("-o", "--output", help="куда писать результат (по умолчанию — на место)")
    ap.add_argument("--no-backup", action="store_true", help="не создавать .bak")
    ap.add_argument("--gps-tty", help="gateway_conf.gps_tty_path, например /dev/ttyAMA0")
    ap.add_argument("--ftime", choices=["off", "all_sf", "high_capacity"],
                    help="режим fine timestamp (SX1303)")
    ap.add_argument("--gateway-id", help="gateway_conf.gateway_ID (16 hex)")
    ap.add_argument("--server", help="адрес сетевого сервера")
    ap.add_argument("--port-up", type=int)
    ap.add_argument("--port-down", type=int)
    ap.add_argument("--lat", type=float)
    ap.add_argument("--lon", type=float)
    ap.add_argument("--alt", type=int)
    ap.add_argument("--fake-gps", action="store_true",
                    help="принудительно включить fake_gps (стенд без антенны)")
    args = ap.parse_args()

    raw = open(args.file, encoding="utf-8").read()
    try:
        cfg = json.loads(strip_comments(raw))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"[x] не разобрать {args.file}: {exc}")

    sx_key = find_section(cfg, SX130X_KEYS)
    sx = cfg[sx_key]
    gw = cfg.setdefault("gateway_conf", {})
    changes = []

    if args.ftime is not None:
        ft = sx.setdefault("fine_timestamp", {})
        if args.ftime == "off":
            ft["enable"] = False
            changes.append(f"{sx_key}.fine_timestamp.enable = false")
        else:
            ft["enable"] = True
            ft["mode"] = args.ftime
            changes.append(f"{sx_key}.fine_timestamp = enable/{args.ftime}")

    if args.gps_tty is not None:
        gw["gps_tty_path"] = args.gps_tty
        changes.append(f"gateway_conf.gps_tty_path = {args.gps_tty}")

    gw["fake_gps"] = bool(args.fake_gps)
    changes.append(f"gateway_conf.fake_gps = {str(gw['fake_gps']).lower()}")

    for key, val in (("gateway_ID", args.gateway_id),
                     ("server_address", args.server),
                     ("serv_port_up", args.port_up),
                     ("serv_port_down", args.port_down),
                     ("ref_latitude", args.lat),
                     ("ref_longitude", args.lon),
                     ("ref_altitude", args.alt)):
        if val is not None and val != "":
            gw[key] = val
            changes.append(f"gateway_conf.{key} = {val}")

    dst = args.output or args.file
    if dst == args.file and not args.no_backup:
        shutil.copyfile(args.file, args.file + ".bak")

    with open(dst, "w", encoding="utf-8") as fh:
        json.dump(cfg, fh, indent=4, ensure_ascii=False)
        fh.write("\n")

    for line in changes:
        print("    " + line)
    print(f"[+] записано: {dst}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
