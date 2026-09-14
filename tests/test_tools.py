#!/usr/bin/env python3
"""Автопроверки вспомогательных утилит. Запуск: python3 tests/test_tools.py"""

import json
import os
import socket
import struct
import subprocess
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIXTURE = os.path.join(ROOT, "tests", "fixtures", "global_conf.sample.json")
failures = []


def check(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        failures.append(msg)


def test_patcher():
    print("patch_global_conf.py")
    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, "global_conf.json")
        subprocess.run([sys.executable, os.path.join(ROOT, "tools", "patch_global_conf.py"),
                        FIXTURE, "-o", out, "--gps-tty", "/dev/ttyAMA0",
                        "--ftime", "high_capacity", "--gateway-id", "AA555A0000000001",
                        "--server", "127.0.0.1", "--lat", "55.75"],
                       check=True, stdout=subprocess.DEVNULL)
        cfg = json.load(open(out))          # строгий JSON: комментарии сняты
        sx, gw = cfg["SX130x_conf"], cfg["gateway_conf"]
        check(sx["fine_timestamp"] == {"enable": True, "mode": "high_capacity"},
              "fine_timestamp включён в нужном режиме")
        check(gw["gps_tty_path"] == "/dev/ttyAMA0", "gps_tty_path задан")
        check(gw["fake_gps"] is False, "fake_gps выключен")
        check(gw["gateway_ID"] == "AA555A0000000001", "gateway_ID подставлен")
        check(sx["radio_0"]["freq"] == 867500000 and sx["radio_1"]["enable"] is True,
              "региональные параметры радио сохранены")
        check(gw["beacon_period"] == 0, "прочие поля gateway_conf сохранены")

        # выключение тонких меток
        subprocess.run([sys.executable, os.path.join(ROOT, "tools", "patch_global_conf.py"),
                        out, "--ftime", "off", "--no-backup"],
                       check=True, stdout=subprocess.DEVNULL)
        check(json.load(open(out))["SX130x_conf"]["fine_timestamp"]["enable"] is False,
              "--ftime off выключает тонкие метки")


def test_sniffer():
    print("gwsniff.py")
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()

    proc = subprocess.Popen([sys.executable, os.path.join(ROOT, "tools", "gwsniff.py"),
                             "-b", "127.0.0.1", "-p", str(port)],
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    time.sleep(1.0)
    cli = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    cli.settimeout(3)
    payload = json.dumps({"rxpk": [{
        "time": "2026-09-14T10:00:00.123456Z", "tmms": 1473508818123, "tmst": 123456789,
        "ftime": 862000000, "freq": 868.1, "datr": "SF7BW125", "rssis": -80, "lsnr": 9.5,
        "size": 23, "data": "QAEAAAAA"}]}).encode()
    frame = struct.pack("<B", 2) + b"\xab\xcd" + struct.pack("<B", 0) + bytes.fromhex("aa555a0000000001") + payload
    cli.sendto(frame, ("127.0.0.1", port))
    try:
        ack, _ = cli.recvfrom(64)
        check(ack[3] == 1 and ack[1:3] == b"\xab\xcd", "PUSH_ACK с тем же токеном")
    except socket.timeout:
        check(False, "PUSH_ACK с тем же токеном")

    cli.sendto(struct.pack("<B", 2) + b"\x11\x22" + struct.pack("<B", 2) + bytes.fromhex("aa555a0000000001"),
               ("127.0.0.1", port))
    try:
        ack, _ = cli.recvfrom(64)
        check(ack[3] == 4, "PULL_ACK на PULL_DATA")
    except socket.timeout:
        check(False, "PULL_ACK на PULL_DATA")

    time.sleep(0.5)
    proc.terminate()
    out = proc.communicate(timeout=5)[0]
    check("tmms=1473508818123" in out, "tmms напечатан")
    check("ftime=862000000 ns" in out, "ftime напечатан")
    check("SF7BW125" in out, "параметры модуляции напечатаны")


test_patcher()
test_sniffer()
print()
if failures:
    print(f"[x] не пройдено проверок: {len(failures)}")
    sys.exit(1)
print("[+] все проверки пройдены")
