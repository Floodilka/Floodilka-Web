# Режим технических работ для Floodilka

Система автоматического показа страницы технических работ во время деплоя.

## Как это работает

1. **Автоматически**: При запуске `update-zero-downtime.sh` система:
   - Включает режим технических работ в начале обновления backend
   - Показывает пользователям красивую страницу "Техническое обслуживание"
   - Отключает режим после успешного обновления frontend

2. **Вручную**: Можно управлять режимом технических работ независимо

## Файлы системы

- `nginx-https-with-maintenance.conf` - Конфигурация nginx с поддержкой maintenance режима
- `enable-maintenance.sh` - Скрипт включения режима технических работ
- `disable-maintenance.sh` - Скрипт отключения режима технических работ
- `maintenance.html` - HTML страница технических работ
- `update-zero-downtime.sh` - Обновленный скрипт деплоя с автоматическим управлением

## Установка

1. **Обновите конфигурацию nginx**:
   ```bash
   sudo cp /var/www/floodilka/deployment/nginx-https-with-maintenance.conf /etc/nginx/sites-available/floodilka
   sudo nginx -t
   sudo systemctl reload nginx
   ```

2. **Сделайте скрипты исполняемыми**:
   ```bash
   sudo chmod +x /var/www/floodilka/deployment/enable-maintenance.sh
   sudo chmod +x /var/www/floodilka/deployment/disable-maintenance.sh
   ```

## Использование

### Автоматическое управление (рекомендуется)

Просто используйте обычный скрипт деплоя:
```bash
sudo bash update-zero-downtime.sh
```

Система автоматически:
- ✅ Включит режим технических работ
- ✅ Обновит backend (5-10 сек downtime)
- ✅ Соберет frontend (5 минут)
- ✅ Отключит режим технических работ

### Ручное управление

**Включить режим технических работ**:
```bash
sudo bash enable-maintenance.sh
```

**Отключить режим технических работ**:
```bash
sudo bash disable-maintenance.sh
```

## Что видят пользователи

### В обычном режиме
- Полный доступ к Floodilka
- Все функции работают

### В режиме технических работ
- Красивая страница с анимацией
- Сообщение "Техническое обслуживание"
- Автоматическая перезагрузка каждые 10 секунд
- Кнопка "Проверить доступность"

## Технические детали

### Как работает nginx конфигурация

```nginx
# Переменная для управления режимом
set $maintenance_mode 0;  # 0 = обычный режим, 1 = технические работы

# Если режим включен - возвращаем 503 ошибку
if ($maintenance_mode = 1) {
    return 503;
}

# Обработка 503 ошибки - показываем maintenance страницу
error_page 503 @maintenance;
location @maintenance {
    root /var/www/floodilka/maintenance;
    rewrite ^(.*)$ /maintenance.html break;
}
```

### Безопасность

- ✅ Резервные копии конфигурации nginx
- ✅ Проверка синтаксиса перед применением
- ✅ Автоматический откат при ошибках
- ✅ Проверка статуса backend перед отключением

## Мониторинг

**Проверить статус**:
```bash
# Статус nginx
sudo systemctl status nginx

# Статус backend
sudo -u floodilka pm2 status

# Логи nginx
sudo tail -f /var/log/nginx/floodilka-error.log

# Логи backend
sudo -u floodilka pm2 logs floodilka-backend
```

**Проверить режим технических работ**:
```bash
curl -I https://floodilka.com
# Должен вернуть 503 в maintenance режиме или 200 в обычном
```

## Устранение проблем

### Если режим технических работ "застрял"

1. **Проверить статус backend**:
   ```bash
   sudo -u floodilka pm2 status
   ```

2. **Если backend не работает - запустить**:
   ```bash
   sudo -u floodilka pm2 start server.js --name floodilka-backend
   ```

3. **Принудительно отключить режим**:
   ```bash
   sudo bash disable-maintenance.sh
   ```

### Если nginx не перезагружается

1. **Проверить синтаксис**:
   ```bash
   sudo nginx -t
   ```

2. **Восстановить из резервной копии**:
   ```bash
   sudo cp /etc/nginx/sites-available/floodilka.backup.* /etc/nginx/sites-available/floodilka
   sudo systemctl reload nginx
   ```

## Преимущества

- ✅ **Zero-downtime для backend** - PM2 cluster mode
- ✅ **Красивый UX** - пользователи видят информативную страницу
- ✅ **Автоматическое восстановление** - страница сама проверяет доступность
- ✅ **Безопасность** - автоматические резервные копии
- ✅ **Мониторинг** - понятные логи и статусы

## Время простоя

- **Backend**: 5-10 секунд (только при смене режима PM2)
- **Frontend**: 0 секунд (атомарная замена файлов)
- **Пользователи видят maintenance**: 5-10 минут (время сборки frontend)

Результат: **Минимальный downtime с отличным UX!**
