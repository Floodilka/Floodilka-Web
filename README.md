# Boltushka Monorepo

> Монорепозиторий для Electron desktop-клиента и web SPA с общим React/Vite рендерером.

## Структура

```
apps/
  desktop/   # Electron main + preload
  web/       # SPA-обёртка для веб-сборки
packages/
  renderer/  # Общий React/Vite UI
  shared/    # Общие утилиты и типы
```

## Быстрый старт

```bash
pnpm install
pnpm -w run dev          # параллельный запуск dev-скриптов (заглушки)
```

## Скрипты верхнего уровня

| Команда             | Описание                             |
| ------------------- | ------------------------------------ |
| `pnpm -w run dev`   | Запуск всех dev-скриптов (по мере реализации) |
| `pnpm -w run build` | Сборка всех пакетов                  |
| `pnpm -w run lint`  | Проверка ESLint                      |
| `pnpm -w run format`| Форматирование Prettier              |
| `pnpm -w run typecheck` | Проверка типов TypeScript        |

## TODO

- Заполнить данные приложения (Product name, AppId, BundleId).
- Добавить реальные иконки (`apps/desktop/resources/icon.*`).
- Настроить подпись macOS (APPLE_ID, APPLE_TEAM_ID, APPLE_APP_SPECIFIC_PASSWORD).
- Настроить подпись Windows (CSC_LINK, CSC_KEY_PASSWORD).
- Создать GitHub токен `GH_TOKEN` для публикации релизов.
- Определить базовый URL SPA (`WEB_BASE_URL`).

## Секреты для GitHub Actions

| Ключ | Назначение | Где взять |
| ---- | ---------- | --------- |
| `GH_TOKEN` | Публикация релизов и автообновлений | GitHub Personal Access Token |
| `APPLE_ID` | Подпись и notarization macOS | Apple Developer Account |
| `APPLE_TEAM_ID` | Team ID для подписи | Apple Developer Account |
| `APPLE_APP_SPECIFIC_PASSWORD` | Пароль для notarization | Apple ID (App-Specific Password) |
| `CSC_LINK` | PFX/сертификат для Windows подписи | Сертификат подписи кода |
| `CSC_KEY_PASSWORD` | Пароль к сертификату | Задает владелец сертификата |

> ⚠️ Все секреты должны храниться в GitHub Actions Secrets, не коммитить их в репозиторий.

