#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Шаг 1. Подготовка Raspberry Pi 4: SPI, UART под GNSS, ядровой PPS, пакеты.
# После выполнения требуется перезагрузка.
# ---------------------------------------------------------------------------
. "$(dirname "$0")/lib/common.sh"
load_env
need_root

BOOT="$(boot_dir)"
CFG="$BOOT/config.txt"
CMDLINE="$BOOT/cmdline.txt"
REBOOT_NEEDED=0

log "boot-каталог: $BOOT"
backup_once "$CFG"
backup_once "$CMDLINE"

# --- 1. Пакеты ------------------------------------------------------------
log "установка пакетов"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
PKGS="git build-essential chrony pps-tools python3 minicom"
[ "${GPS_MODE}" = "gpsd" ] && PKGS="$PKGS gpsd gpsd-clients socat"
# shellcheck disable=SC2086
apt-get install -y -qq $PKGS
ok "пакеты установлены"

# --- 2. config.txt --------------------------------------------------------
log "правка $CFG"
ensure_line "$CFG" "dtparam=spi=on"           && REBOOT_NEEDED=1
ensure_line "$CFG" "enable_uart=1"            && REBOOT_NEEDED=1

# Освобождаем аппаратный PL011 (GPIO14/15) от Bluetooth -> /dev/ttyAMA0.
if [ "$GPS_TTY" = "/dev/ttyAMA0" ] || [ "$GPS_TTY" = "/dev/serial0" ]; then
    ensure_line "$CFG" "dtoverlay=disable-bt" && REBOOT_NEEDED=1
    if systemctl list-unit-files | grep -q '^hciuart\.service'; then
        systemctl disable hciuart 2>/dev/null || true
        ok "hciuart отключён"
    fi
else
    # mini-UART: без фиксации частоты ядра плывёт скорость обмена
    ensure_line "$CFG" "core_freq_min=500"    && REBOOT_NEEDED=1
fi

# Ядровой PPS-клиент на GPIO (только для системных часов).
if [ "${ENABLE_PI_PPS}" = "1" ]; then
    if grep -q '^dtoverlay=pps-gpio' "$CFG"; then
        log "pps-gpio уже настроен: $(grep '^dtoverlay=pps-gpio' "$CFG")"
    else
        ensure_line "$CFG" "dtoverlay=pps-gpio,gpiopin=${PPS_GPIO}" && REBOOT_NEEDED=1
    fi
    ensure_line /etc/modules "pps-gpio" || true
fi

# --- 3. Консоль на UART мешает NMEA --------------------------------------
log "отключение последовательной консоли"
if grep -qE 'console=(serial0|ttyAMA0|ttyS0)[^ ]*' "$CMDLINE"; then
    sed -i -E 's/console=(serial0|ttyAMA0|ttyS0)[^ ]*[ ]?//g' "$CMDLINE"
    ok "console=... удалён из cmdline.txt"
    REBOOT_NEEDED=1
fi
for unit in serial-getty@ttyAMA0 serial-getty@ttyS0 serial-getty@serial0; do
    if systemctl is-enabled "$unit" >/dev/null 2>&1; then
        systemctl stop "$unit"    2>/dev/null || true
        systemctl disable "$unit" 2>/dev/null || true
        ok "$unit отключён"
    fi
done

# --- 4. gpsd не должен мешать в режиме direct -----------------------------
if [ "$GPS_MODE" = "direct" ] && systemctl list-unit-files | grep -q '^gpsd\.service'; then
    warn "режим direct: gpsd будет отключён, чтобы не занимать $GPS_TTY"
    systemctl disable --now gpsd.socket gpsd.service 2>/dev/null || true
fi

# --- 5. Каталог конфигурации ---------------------------------------------
install -d -m 0755 "$CONF_DIR"
if [ ! -f "$CONF_DIR/gateway.env" ]; then
    install -m 0644 "$REPO_ROOT/config/gateway.env.example" "$CONF_DIR/gateway.env"
    ok "создан $CONF_DIR/gateway.env — проверьте параметры перед шагом 4"
fi

echo
if [ "$REBOOT_NEEDED" = "1" ]; then
    c_yell "Требуется перезагрузка: sudo reboot"
    c_yell "После неё запустите scripts/02-build-sx1302-hal.sh"
else
    ok "Изменений в boot-конфигурации не потребовалось"
fi
