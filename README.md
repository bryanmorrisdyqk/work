# GPS-метки времени для Waveshare SX1302/SX1303 LoRaWAN HAT на Raspberry Pi 4

Набор скриптов и конфигураций, который доводит шлюз до состояния, когда каждый
принятый LoRa-пакет уходит на сетевой сервер с привязкой к шкале GPS:

| Поле в `rxpk` | Что это | Условие появления |
|---|---|---|
| `tmst` | счётчик концентратора, мкс | всегда |
| `tmms` | GPS-время приёма, мс от эпохи GPS (06.01.1980) | GNSS захвачен + PPS дошёл до концентратора |
| `time` | UTC-время приёма | то же |
| `ftime` | тонкая метка времени, нс (для TDOA-геолокации) | **только SX1303**, `fine_timestamp.enable=true`, BW125 |

`ftime` — то, ради чего в плате стоит именно SX1303: SX1302 отличается от него
как раз отсутствием блока тонких меток времени.

## Как это устроено

```
   GNSS-модуль платы
        │  NMEA (UART, 9600) ──────► Raspberry Pi ──► lora_pkt_fwd (UTC-время)
        │                                          └► chrony (системные часы)
        └─ 1 PPS ─┬─────────────────► SX1303: защёлкивает свой счётчик по фронту PPS
                  └─(опц.) GPIO Pi ──► /dev/pps0 → chrony (точность системных часов)
```

Ключевая мысль: **метки времени пакетов строит концентратор, а не Linux.**
Пакет-форвардер раз в секунду сопоставляет «показание счётчика в момент PPS» с
«UTC из NMEA» и получает линейную привязку счётчик → шкала GPS. Поэтому:

* без NMEA на UART будет `tmst`, но не будет `tmms`/`time`;
* без PPS на концентраторе привязка не строится вообще;
* PPS на GPIO самой Raspberry Pi (`/dev/pps0`) нужен **только** для точности
  системных часов и на метки пакетов не влияет — его можно не подключать.

Подробнее: [docs/architecture.md](docs/architecture.md).

## Быстрый старт

```bash
git clone https://github.com/bryanmorrisdyqk/work.git lora-gps && cd lora-gps
cp config/gateway.env.example gateway.env
nano gateway.env                     # регион, LNS, пины, режим GPS

sudo ./scripts/01-system-prepare.sh  # SPI, UART, PPS-overlay, пакеты
sudo reboot

sudo ./scripts/02-build-sx1302-hal.sh        # сборка sx1302_hal + проверка SPI
sudo ./scripts/03-gps-time-sync.sh           # chrony/PPS (+ gpsd, если выбран)
sudo ./scripts/04-configure-packet-forwarder.sh   # global_conf.json + systemd
./scripts/05-verify.sh                       # диагностика по всей цепочке
```

Или одной командой: `sudo make all` (см. `Makefile`).

## Что именно меняется в системе

| Файл | Изменение |
|---|---|
| `/boot/firmware/config.txt` | `dtparam=spi=on`, `enable_uart=1`, `dtoverlay=disable-bt`, `dtoverlay=pps-gpio,gpiopin=<N>` |
| `/boot/firmware/cmdline.txt` | убирается `console=serial0,…` — иначе консоль съедает NMEA |
| `/etc/chrony/conf.d/10-lora-gps.conf` | источник времени PPS (или SHM от gpsd) |
| `/etc/lora-gateway/global_conf.json` | `gps_tty_path`, `fake_gps=false`, `fine_timestamp.enable/mode` |
| `/etc/systemd/system/lora-pkt-fwd.service` | автозапуск форвардера со сбросом концентратора |
| `/opt/sx1302_hal` | исходники и бинарники HAL |

Все правки идемпотентны, оригиналы сохраняются рядом как `*.lora-gps.bak`.

## Два режима владения UART (`GPS_MODE`)

* **`direct` (по умолчанию)** — NMEA читает сам пакет-форвардер, `gpsd` отключается.
  chrony дисциплинирует часы по `/dev/pps0` плюс NTP из интернета. Меньше
  движущихся частей; именно так устроено большинство серийных шлюзов.
* **`gpsd`** — UART держит `gpsd`, chrony берёт время через SHM, а форвардеру
  отдаётся псевдотерминал `/dev/lora-gps` (мост `gpspipe → socat`, юнит
  `lora-gps-bridge.service`). Удобно, если к GNSS нужен доступ другим программам.

Одновременно читать один и тот же `/dev/ttyAMA0` двум процессам нельзя —
выбирается ровно один режим.

## Проверка «на живом пакете»

```bash
python3 tools/gwsniff.py -p 1700          # мини-LNS, печатает tmms/ftime
# в global_conf.json временно: "server_address": "127.0.0.1"
sudo systemctl restart lora-pkt-fwd
```

Вывод по каждому принятому кадру:

```
[AA555A0000000001] freq=868.1     SF7BW125   rssi=  -80  snr=  9.5  tmst=123456789  \
tmms=1473508818123 (2026-09-14T10:00:18.123 GPS)  ftime=862000000 ns
```

Прямая проверка связки NMEA + PPS + счётчик концентратора, без сети:

```bash
sudo systemctl stop lora-pkt-fwd
cd /opt/sx1302_hal/libloragw && sudo ./test_loragw_gps
```

## Ограничения тонких меток (`ftime`)

* работают только на SX1303 (на SX1302 `lgw_start` вернёт ошибку);
* только для LoRa при BW 125 кГц;
* `all_sf` — SF5…SF12, `high_capacity` — SF5…SF10, но выше пропускная способность;
* значение имеет смысл только вместе с `tmms`: без GPS-привязки это просто
  уточнение внутреннего счётчика.

## Состав репозитория

```
scripts/01..05        пошаговая установка и диагностика
scripts/lib/common.sh общие функции, загрузка gateway.env
config/               gateway.env.example, chrony-сниппеты, systemd-юниты
tools/patch_global_conf.py   правка global_conf.json (снимает C-комментарии)
tools/gwsniff.py      мини-сервер Semtech UDP для проверки меток
tests/test_tools.py   автопроверки утилит (python3 tests/test_tools.py)
docs/                 архитектура и разбор типовых неисправностей
```

## Проверено / не проверено

Скрипты и утилиты проверены синтаксически и автотестами (`tests/test_tools.py`)
в окружении сборки. Прогон на самом железе выполняется у вас: распиновка
конкретной ревизии платы Waveshare (пины сброса, наличие PPS на GPIO Raspberry
Pi) вынесена в `gateway.env`, а `scripts/05-verify.sh` показывает, что из
цепочки не сходится.
