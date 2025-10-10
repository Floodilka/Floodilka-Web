#!/bin/bash

# Скрипт проверки DNS записей для floodilka доменов

echo "🔍 Проверка DNS записей для floodilka..."
echo ""

TARGET_IP="159.89.110.44"

echo "🌐 floodilka.com:"
COM_IP=$(dig floodilka.com +short | head -n 1)
if [ "$COM_IP" == "$TARGET_IP" ]; then
    echo "   ✅ $COM_IP (правильно)"
else
    echo "   ❌ $COM_IP (ожидается $TARGET_IP)"
fi

echo ""
echo "🌐 www.floodilka.com:"
WWW_COM_IP=$(dig www.floodilka.com +short | head -n 1)
if [ "$WWW_COM_IP" == "$TARGET_IP" ]; then
    echo "   ✅ $WWW_COM_IP (правильно)"
else
    echo "   ❌ $WWW_COM_IP (ожидается $TARGET_IP)"
fi

echo ""
echo "🌐 floodilka.ru:"
RU_IP=$(dig floodilka.ru +short | head -n 1)
if [ "$RU_IP" == "$TARGET_IP" ]; then
    echo "   ✅ $RU_IP (правильно)"
elif [ -z "$RU_IP" ]; then
    echo "   ❌ Не настроено (ожидается $TARGET_IP)"
else
    echo "   ❌ $RU_IP (ожидается $TARGET_IP)"
fi

echo ""
echo "🌐 www.floodilka.ru:"
WWW_RU_IP=$(dig www.floodilka.ru +short | head -n 1)
if [ "$WWW_RU_IP" == "$TARGET_IP" ]; then
    echo "   ✅ $WWW_RU_IP (правильно)"
elif [ -z "$WWW_RU_IP" ]; then
    echo "   ❌ Не настроено (ожидается $TARGET_IP)"
else
    echo "   ❌ $WWW_RU_IP (ожидается $TARGET_IP)"
fi

echo ""
echo "📊 Сводка:"
ALL_OK=true

if [ "$COM_IP" != "$TARGET_IP" ]; then
    echo "   ❌ floodilka.com - требует исправления"
    ALL_OK=false
fi

if [ "$WWW_COM_IP" != "$TARGET_IP" ]; then
    echo "   ❌ www.floodilka.com - требует исправления"
    ALL_OK=false
fi

if [ "$RU_IP" != "$TARGET_IP" ]; then
    echo "   ❌ floodilka.ru - требует исправления"
    ALL_OK=false
fi

if [ "$WWW_RU_IP" != "$TARGET_IP" ]; then
    echo "   ❌ www.floodilka.ru - требует исправления"
    ALL_OK=false
fi

if [ "$ALL_OK" = true ]; then
    echo "   ✅ Все DNS записи настроены правильно!"
    echo ""
    echo "🚀 Можно продолжать миграцию:"
    echo "   cd /var/www/boltushka"
    echo "   sudo bash deployment/migrate-domains.sh"
fi

