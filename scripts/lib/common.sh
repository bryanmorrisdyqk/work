#!/usr/bin/env bash
# Общие функции и загрузка конфигурации для скриптов установки.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

c_red()   { printf '\033[31m%s\033[0m\n' "$*"; }
c_green() { printf '\033[32m%s\033[0m\n' "$*"; }
c_yell()  { printf '\033[33m%s\033[0m\n' "$*"; }

log()  { printf '[*] %s\n' "$*"; }
ok()   { c_green "[+] $*"; }
warn() { c_yell  "[!] $*"; }
die()  { c_red   "[x] $*"; exit 1; }

need_root() {
    [ "$(id -u)" -eq 0 ] || die "Запустите с sudo: sudo $0"
}

# Загрузка gateway.env. Приоритет (по возрастанию):
#   config/gateway.env.example -> /etc/lora-gateway/gateway.env ->
#   ./gateway.env -> переменные окружения вызывающего.
load_env() {
    local keys key saved_vals=()
    keys="SX1302_RESET_PIN SX1302_POWER_EN_PIN SX1261_RESET_PIN AD5338R_RESET_PIN
          GPS_TTY GPS_BAUD GPS_MODE ENABLE_PI_PPS PPS_GPIO
          HAL_REPO HAL_VERSION INSTALL_DIR CONF_DIR GLOBAL_CONF_TEMPLATE FTIME_MODE
          SERVER_ADDRESS SERV_PORT_UP SERV_PORT_DOWN GATEWAY_ID
          REF_LATITUDE REF_LONGITUDE REF_ALTITUDE"

    # запомнить то, что уже задано в окружении — оно перекроет файлы
    for key in $keys; do
        if [ -n "${!key+x}" ]; then
            saved_vals+=("$key=${!key}")
        fi
    done

    set -a
    # shellcheck disable=SC1091
    [ -f "$REPO_ROOT/config/gateway.env.example" ] && . "$REPO_ROOT/config/gateway.env.example"
    # shellcheck disable=SC1091
    [ -f /etc/lora-gateway/gateway.env ] && . /etc/lora-gateway/gateway.env
    # shellcheck disable=SC1091
    [ -f "$REPO_ROOT/gateway.env" ] && . "$REPO_ROOT/gateway.env"
    set +a

    local kv
    for kv in "${saved_vals[@]+"${saved_vals[@]}"}"; do
        export "${kv%%=*}=${kv#*=}"
    done
}

# Каталог с config.txt/cmdline.txt: Bookworm — /boot/firmware, раньше — /boot.
boot_dir() {
    if [ -f /boot/firmware/config.txt ]; then
        echo /boot/firmware
    elif [ -f /boot/config.txt ]; then
        echo /boot
    else
        die "Не найден config.txt — это точно Raspberry Pi OS?"
    fi
}

# Идемпотентно добавить строку в файл (если её там ещё нет).
ensure_line() {
    local file="$1" line="$2"
    if ! grep -qxF -- "$line" "$file" 2>/dev/null; then
        printf '%s\n' "$line" >> "$file"
        ok "в $file добавлено: $line"
        return 0
    fi
    log "в $file уже есть: $line"
    return 1
}

backup_once() {
    local file="$1"
    [ -f "$file" ] || return 0
    [ -f "${file}.lora-gps.bak" ] && return 0
    cp -a "$file" "${file}.lora-gps.bak"
    log "резервная копия: ${file}.lora-gps.bak"
}

have() { command -v "$1" >/dev/null 2>&1; }
