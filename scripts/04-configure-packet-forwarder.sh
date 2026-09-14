#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Шаг 4. Конфигурация пакет-форвардера: GPS-время + fine timestamp, systemd-юнит.
# ---------------------------------------------------------------------------
. "$(dirname "$0")/lib/common.sh"
load_env
need_root

PKTFWD_DIR="$INSTALL_DIR/packet_forwarder"
[ -x "$PKTFWD_DIR/lora_pkt_fwd" ] || die "не собран lora_pkt_fwd — выполните шаг 2"

TEMPLATE="$PKTFWD_DIR/$GLOBAL_CONF_TEMPLATE"
[ -f "$TEMPLATE" ] || die "нет шаблона $TEMPLATE (доступные: $(cd "$PKTFWD_DIR" && ls global_conf.json.* | tr '\n' ' '))"

install -d -m 0755 "$CONF_DIR"
TARGET="$CONF_DIR/global_conf.json"

if [ -f "$TARGET" ]; then
    log "используется существующий $TARGET (шаблон не перезаписывается)"
else
    install -m 0644 "$TEMPLATE" "$TARGET"
    ok "создан $TARGET из $GLOBAL_CONF_TEMPLATE"
fi

# --- Gateway EUI ----------------------------------------------------------
GW_ID="$GATEWAY_ID"
if [ -z "$GW_ID" ] && [ -x "$INSTALL_DIR/util_chip_id/chip_id" ]; then
    log "определение EUI концентратора"
    "$INSTALL_DIR/tools/reset_lgw.sh" start >/dev/null 2>&1 || true
    GW_ID="$("$INSTALL_DIR/util_chip_id/chip_id" -d /dev/spidev0.0 2>/dev/null \
             | grep -oiE '[0-9a-f]{16}' | head -n1 || true)"
    "$INSTALL_DIR/tools/reset_lgw.sh" stop >/dev/null 2>&1 || true
    [ -n "$GW_ID" ] && ok "EUI концентратора: $GW_ID" || warn "EUI не прочитан, оставлен из шаблона"
fi

# --- Какой tty отдать форвардеру -----------------------------------------
if [ "$GPS_MODE" = "gpsd" ]; then
    FWD_TTY=/dev/lora-gps
else
    FWD_TTY="$GPS_TTY"
fi
[ -e "$FWD_TTY" ] || warn "$FWD_TTY сейчас отсутствует — проверьте шаги 1/3"

# --- Правка global_conf.json ---------------------------------------------
log "настройка $TARGET"
python3 "$REPO_ROOT/tools/patch_global_conf.py" "$TARGET" \
    --gps-tty "$FWD_TTY" \
    --ftime "$FTIME_MODE" \
    ${GW_ID:+--gateway-id "$GW_ID"} \
    --server "$SERVER_ADDRESS" \
    --port-up "$SERV_PORT_UP" \
    --port-down "$SERV_PORT_DOWN" \
    --lat "$REF_LATITUDE" --lon "$REF_LONGITUDE" --alt "$REF_ALTITUDE"

# local_conf.json перекрывает global_conf — чтобы не удивляться, создаём пустой
[ -f "$CONF_DIR/local_conf.json" ] || echo '{}' > "$CONF_DIR/local_conf.json"

# --- systemd --------------------------------------------------------------
log "установка lora-pkt-fwd.service"
sed -e "s|@INSTALL_DIR@|$INSTALL_DIR|g" \
    -e "s|@CONF_DIR@|$CONF_DIR|g" \
    "$REPO_ROOT/config/lora-pkt-fwd.service" > /etc/systemd/system/lora-pkt-fwd.service
systemctl daemon-reload
systemctl enable lora-pkt-fwd.service >/dev/null
systemctl restart lora-pkt-fwd.service
sleep 3

if systemctl is-active --quiet lora-pkt-fwd.service; then
    ok "пакет-форвардер запущен"
else
    warn "форвардер не поднялся, последние строки журнала:"
    journalctl -u lora-pkt-fwd -n 30 --no-pager | sed 's/^/    /'
fi

echo
ok "Далее: scripts/05-verify.sh"
