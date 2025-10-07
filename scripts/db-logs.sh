#!/bin/bash

# Скрипт для просмотра логов MongoDB

echo "📋 Просмотр логов MongoDB..."

# Перейти в корневую директорию проекта
cd "$(dirname "$0")/.."

# Показать логи
docker-compose logs -f mongodb
