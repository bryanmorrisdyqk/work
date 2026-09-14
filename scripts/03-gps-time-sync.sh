#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Шаг 3. Синхронизация системных часов по GNSS (chrony + PPS, опционально gpsd).
#
# ВАЖНО: системные часы НЕ участвуют в формировании меток времени LoRa-пакетов.
# Метки (tmms/ftime) строит сам концентратор по аппаратному PPS с платы.
# Этот шаг нужен для корректных логов, TLS и поля "time" при потере GPS.
# ---------------------------------------------------------------------------
. "$(dirname "$0")/lib/common.sh"
load_env
need_root

CHRONY_MAIN=/etc/chrony/chrony.conf
[ -f "$CHRONY_MAIN" ] || CHRONY_MAIN=/etc/chrony.conf
[ -f "$CHRONY_MAIN" ] || die "chrony не установлен (запустите шаг 1)"

case "$GPS_MODE" in
  direct) SNIPPET="$REPO_ROOT/config/chrony-gps-direct.conf" ;;
  gpsd)   SNIPPET="$REPO_ROOT/config/chrony-gps-gpsd.conf" ;;
  *)      die "GPS_MODE должен быть direct или gpsd (сейчас: $GPS_MODE)" ;;
esac

# --- gpsd ------------------------------------------------------------------
if [ "$GPS_MODE" = "gpsd" ]; then
    have gpsd  || die "gpsd не установлен"
    have socat || die "socat не установлен"
    backup_once /etc/default/gpsd
    cat > /etc/default/gpsd <<GPSD
# Сгенерировано lora-gps
START_DAEMON="true"
USBAUTO="false"
DEVICES="$GPS_TTY /dev/pps0"
GPSD_OPTIONS="-n"
GPSD
    systemctl enable gpsd.socket gpsd.service >/dev/null 2>&1 || true
    systemctl restart gpsd.socket gpsd.service
    ok "gpsd слушает $GPS_TTY"

    install -m 0644 "$REPO_ROOT/config/lora-gps-bridge.service" /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable --now lora-gps-bridge.service
    ok "мост NMEA -> /dev/lora-gps поднят (укажите его в gps_tty_path)"
else
    systemctl disable --now gpsd.socket gpsd.service 2>/dev/null || true
    systemctl disable --now lora-gps-bridge.service   2>/dev/null || true
fi

# --- chrony ---------------------------------------------------------------
CONF_D=/etc/chrony/conf.d
if [ -d "$CONF_D" ] && grep -qE '^\s*include\s+/etc/chrony/conf\.d/' "$CHRONY_MAIN"; then
    install -m 0644 "$SNIPPET" "$CONF_D/10-lora-gps.conf"
    ok "конфигурация chrony: $CONF_D/10-lora-gps.conf"
else
    backup_once "$CHRONY_MAIN"
    # вырезаем предыдущий блок и вставляем актуальный
    sed -i '/# >>> lora-gps >>>/,/# <<< lora-gps <<</d' "$CHRONY_MAIN"
    {
        echo "# >>> lora-gps >>>"
        cat "$SNIPPET"
        echo "# <<< lora-gps <<<"
    } >> "$CHRONY_MAIN"
    ok "блок lora-gps добавлен в $CHRONY_MAIN"
fi

systemctl restart chrony 2>/dev/null || systemctl restart chronyd
ok "chrony перезапущен"

# --- Быстрая диагностика ---------------------------------------------------
echo
if [ "${ENABLE_PI_PPS}" = "1" ]; then
    if [ -e /dev/pps0 ]; then
        log "проверка импульсов PPS (5 с)…"
        if timeout 5 ppstest /dev/pps0 2>&1 | grep -q 'assert'; then
            ok "PPS-импульсы приходят на GPIO${PPS_GPIO}"
        else
            warn "импульсов на /dev/pps0 нет."
            warn "Либо GNSS ещё не захватил спутники (нужно 30–90 с под открытым небом),"
            warn "либо PPS платы не заведён на GPIO${PPS_GPIO} — тогда поставьте ENABLE_PI_PPS=0."
            warn "На метки времени LoRa это не влияет: концентратор получает PPS напрямую."
        fi
    else
        warn "/dev/pps0 отсутствует — проверьте dtoverlay=pps-gpio и перезагрузку"
    fi
fi

chronyc sources 2>/dev/null | sed 's/^/    /' || true
echo
ok "Далее: scripts/04-configure-packet-forwarder.sh"
