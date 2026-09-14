#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Шаг 5. Диагностика: проходит ли GPS-время до меток LoRa-пакетов.
# Запускать можно сколько угодно раз, ничего не меняет.
# ---------------------------------------------------------------------------
. "$(dirname "$0")/lib/common.sh"
load_env

FAILED=0
section() { echo; printf '\033[1m== %s\033[0m\n' "$*"; }
bad() { c_red "[x] $*"; FAILED=$((FAILED+1)); }

section "1. Загрузочная конфигурация"
BOOT="$(boot_dir)"
grep -q '^dtparam=spi=on' "$BOOT/config.txt" && ok "SPI включён" || bad "нет dtparam=spi=on"
grep -q '^enable_uart=1'  "$BOOT/config.txt" && ok "UART включён" || bad "нет enable_uart=1"
if grep -qE 'console=(serial0|ttyAMA0|ttyS0)' "$BOOT/cmdline.txt"; then
    bad "в cmdline.txt осталась консоль на UART — она съедает NMEA"
else
    ok "последовательная консоль отключена"
fi
if [ "${ENABLE_PI_PPS}" = "1" ]; then
    grep -q '^dtoverlay=pps-gpio' "$BOOT/config.txt" && ok "overlay pps-gpio прописан" \
        || warn "нет dtoverlay=pps-gpio (нужен только для системных часов)"
fi

section "2. NMEA на $GPS_TTY"
if [ -e "$GPS_TTY" ]; then
    ok "$GPS_TTY существует"
    if [ "$GPS_MODE" = "direct" ] && systemctl is-active --quiet lora-pkt-fwd; then
        warn "порт занят пакет-форвардером — чтение NMEA пропущено"
        warn "для ручной проверки: sudo systemctl stop lora-pkt-fwd && sudo $0"
    else
        have stty && stty -F "$GPS_TTY" "${GPS_BAUD}" raw -echo 2>/dev/null || true
        NMEA="$(timeout 5 head -c 2000 "$GPS_TTY" 2>/dev/null || true)"
        if echo "$NMEA" | grep -qE '\$G[PNLA](RMC|GGA)'; then
            ok "NMEA идёт"
            echo "$NMEA" | grep -oE '\$G[PNLA](RMC|GGA)[^*]*' | tail -n 2 | sed 's/^/    /'
            if echo "$NMEA" | grep -E '\$G[PNLA]RMC' | grep -q ',A,'; then
                ok "признак валидности RMC = A (спутники захвачены)"
            else
                warn "RMC отдаёт V — фикса ещё нет. Антенна под открытым небом, ждать 30–90 с"
            fi
        else
            bad "NMEA не читается с $GPS_TTY"
        fi
    fi
else
    bad "$GPS_TTY отсутствует"
fi

section "3. PPS на Raspberry Pi (только системные часы)"
if [ "${ENABLE_PI_PPS}" != "1" ]; then
    log "отключён в конфигурации (ENABLE_PI_PPS=0) — пропуск"
elif [ -e /dev/pps0 ]; then
    if timeout 5 ppstest /dev/pps0 2>&1 | grep -q 'assert'; then
        ok "импульсы PPS на GPIO${PPS_GPIO} приходят"
    else
        warn "импульсов нет: нет фикса GNSS либо PPS не заведён на GPIO${PPS_GPIO}"
    fi
else
    warn "/dev/pps0 не создан"
fi

section "4. Системные часы (chrony)"
if have chronyc; then
    chronyc tracking 2>/dev/null | grep -E 'Reference ID|Stratum|System time|Leap' | sed 's/^/    /'
    chronyc sources 2>/dev/null | sed 's/^/    /'
    chronyc sources 2>/dev/null | grep -qE '^\^?\*|^#\*' && ok "часы синхронизированы" \
        || warn "источник времени ещё не выбран"
else
    warn "chronyc не найден"
fi

section "5. Конфигурация пакет-форвардера"
CONF="$CONF_DIR/global_conf.json"
if [ -f "$CONF" ]; then
    CONF_OK=0
    python3 - "$CONF" "$REPO_ROOT" <<'PYEOF' || CONF_OK=$?
import json, sys
raw = open(sys.argv[1]).read()
sys.path.insert(0, sys.argv[2] + "/tools")
try:
    from patch_global_conf import strip_comments
except ImportError:
    strip_comments = lambda t: t
cfg = json.loads(strip_comments(raw))
sx = next(cfg[k] for k in ("SX130x_conf", "SX1302_conf", "SX1301_conf") if k in cfg)
gw = cfg.get("gateway_conf", {})
ft = sx.get("fine_timestamp", {})
print(f"    gps_tty_path   : {gw.get('gps_tty_path')!r}")
print(f"    fake_gps       : {gw.get('fake_gps')}")
print(f"    fine_timestamp : enable={ft.get('enable')} mode={ft.get('mode')!r}")
print(f"    gateway_ID     : {gw.get('gateway_ID')}")
print(f"    server         : {gw.get('server_address')}:{gw.get('serv_port_up')}")
problems = []
if not gw.get("gps_tty_path"):
    problems.append("gps_tty_path пуст — GPS-времени (tmms) не будет")
if gw.get("fake_gps"):
    problems.append("fake_gps=true — время берётся из опорных координат, а не с GNSS")
if not ft.get("enable"):
    problems.append("fine_timestamp.enable=false — тонких меток ftime не будет")
for p in problems:
    print("    ! " + p)
sys.exit(2 if problems else 0)
PYEOF
    if [ "$CONF_OK" -eq 0 ]; then
        ok "конфигурация выглядит корректно"
    else
        warn "см. замечания выше"
    fi
else
    bad "нет $CONF — выполните шаг 4"
fi

section "6. Служба и признаки GPS-синхронизации"
if systemctl is-active --quiet lora-pkt-fwd; then
    ok "lora-pkt-fwd работает ($(systemctl show -p ActiveEnterTimestamp --value lora-pkt-fwd))"
    LOGS="$(journalctl -u lora-pkt-fwd --since '-10 min' --no-pager 2>/dev/null || true)"
    if echo "$LOGS" | grep -qEi 'valid time reference|gps_ref_valid|GPS time ref'; then
        ok "форвардер сообщает о валидной опорной точке GPS"
    fi
    echo "$LOGS" | grep -iE 'gps|pps|time ref|ftime|fine' | tail -n 12 | sed 's/^/    /'
    echo "$LOGS" | grep -iE 'ERROR|WARNING' | tail -n 5 | sed 's/^/    /'
else
    bad "служба lora-pkt-fwd не запущена"
fi

echo
if [ "$FAILED" -eq 0 ]; then
    c_green "Критичных проблем не найдено."
else
    c_red "Критичных проблем: $FAILED — см. docs/troubleshooting.md"
fi
cat <<'HINT'

Полная проверка меток «на живом пакете»:
  1) sudo systemctl stop lora-pkt-fwd
  2) python3 tools/gwsniff.py -p 1700          (в отдельном терминале)
  3) в /etc/lora-gateway/global_conf.json временно server_address = "127.0.0.1"
  4) sudo systemctl start lora-pkt-fwd  — в выводе gwsniff у пакетов должны
     появиться tmms=<число> (GPS-время) и ftime=<число> ns (тонкая метка SX1303).

Проверка связки «NMEA + PPS + счётчик концентратора» напрямую:
  sudo systemctl stop lora-pkt-fwd
  cd /opt/sx1302_hal/libloragw && sudo ./test_loragw_gps
HINT
[ "$FAILED" -eq 0 ]
