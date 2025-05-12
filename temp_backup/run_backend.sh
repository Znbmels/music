#!/bin/bash
# Путь к Python в виртуальном окружении
PYTHON_BIN="/Users/zainab/Desktop/music/venv/bin/python"

# Перейти в директорию бэкенда
cd "$(dirname "$0")/backend"

# Запустить Django сервер
exec $PYTHON_BIN manage.py runserver 127.0.0.1:8000 