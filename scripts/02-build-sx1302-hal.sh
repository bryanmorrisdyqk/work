#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Шаг 2. Сборка sx1302_hal (HAL + пакет-форвардер) и настройка reset_lgw.sh.
# ---------------------------------------------------------------------------
. "$(dirname "$0")/lib/common.sh"
load_env
need_root

SRC="$INSTALL_DIR"

if [ -d "$SRC/.git" ]; then
    log "обновление $SRC"
    git -C "$SRC" fetch --tags --depth 50 origin
else
    log "клонирование $HAL_REPO ($HAL_VERSION) в $SRC"
    git clone --branch "$HAL_VERSION" --depth 1 "$HAL_REPO" "$SRC"
fi
git -C "$SRC" checkout -q "$HAL_VERSION"
ok "исходники: $(git -C "$SRC" describe --tags --always)"

# --- Пины сброса концентратора -------------------------------------------
RESET="$SRC/tools/reset_lgw.sh"
[ -f "$RESET" ] || die "не найден $RESET"
backup_once "$RESET"
sed -i -E \
    -e "s/^(SX1302_RESET_PIN=).*/\1${SX1302_RESET_PIN}/" \
    -e "s/^(SX1302_POWER_EN_PIN=).*/\1${SX1302_POWER_EN_PIN}/" \
    -e "s/^(SX1261_RESET_PIN=).*/\1${SX1261_RESET_PIN}/" \
    -e "s/^(AD5338R_RESET_PIN=).*/\1${AD5338R_RESET_PIN}/" \
    "$RESET"
chmod +x "$RESET"
ok "пины сброса: RESET=${SX1302_RESET_PIN} POWER_EN=${SX1302_POWER_EN_PIN}"

# --- Сборка ---------------------------------------------------------------
log "сборка (make -j$(nproc))"
make -C "$SRC" clean >/dev/null
make -C "$SRC" -j"$(nproc)" all

for bin in packet_forwarder/lora_pkt_fwd libloragw/test_loragw_gps util_chip_id/chip_id; do
    [ -x "$SRC/$bin" ] || warn "не собрано: $bin"
done
ok "сборка завершена"

# --- Проверка связи с концентратором -------------------------------------
log "проверка SPI-связи с SX1303 (chip_id)"
if [ -x "$SRC/util_chip_id/chip_id" ]; then
    "$RESET" start >/dev/null 2>&1 || true
    if EUI_OUT="$("$SRC/util_chip_id/chip_id" -d /dev/spidev0.0 2>&1)"; then
        echo "$EUI_OUT" | sed 's/^/    /'
        ok "концентратор отвечает"
    else
        echo "$EUI_OUT" | sed 's/^/    /'
        warn "концентратор не ответил — проверьте SPI (dtparam=spi=on), питание и пины сброса"
    fi
    "$RESET" stop >/dev/null 2>&1 || true
fi

echo
ok "Далее: scripts/03-gps-time-sync.sh"
