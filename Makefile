# Установка GPS-таймстемпов для Waveshare SX1302/SX1303 HAT на Raspberry Pi 4.
# Большинство целей требуют root: sudo make <цель>

SHELL := /bin/bash

.PHONY: help prepare build gps pktfwd verify all test clean-config

help:
	@echo "make prepare  — шаг 1: SPI, UART, PPS-overlay, пакеты (нужна перезагрузка)"
	@echo "make build    — шаг 2: сборка sx1302_hal, проверка связи с концентратором"
	@echo "make gps      — шаг 3: chrony/PPS, при GPS_MODE=gpsd — gpsd и мост NMEA"
	@echo "make pktfwd   — шаг 4: global_conf.json (GPS + fine timestamp) и systemd"
	@echo "make verify   — шаг 5: диагностика всей цепочки"
	@echo "make all      — шаги 2..5 подряд (шаг 1 и перезагрузка — отдельно)"
	@echo "make test     — автопроверки утилит, железо не нужно"

prepare:
	./scripts/01-system-prepare.sh

build:
	./scripts/02-build-sx1302-hal.sh

gps:
	./scripts/03-gps-time-sync.sh

pktfwd:
	./scripts/04-configure-packet-forwarder.sh

verify:
	./scripts/05-verify.sh

all: build gps pktfwd verify

test:
	python3 tests/test_tools.py
