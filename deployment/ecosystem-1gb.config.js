/**
 * PM2 Ecosystem конфигурация для серверов с ограниченной памятью (1GB RAM)
 *
 * Использует только 1 инстанс, что вызовет кратковременный простой при reload (~2-3 сек)
 * Рекомендуется вместо этого добавить swap и использовать ecosystem.config.js с 2 инстансами
 */

module.exports = {
  apps: [{
    name: 'floodilka-backend',
    script: './server.js',
    cwd: '/var/www/floodilka/backend',

    // Только 1 инстанс для экономии памяти
    instances: 1,
    exec_mode: 'cluster',

    // Автоматические параметры
    max_memory_restart: '400M', // Меньше лимит для 1GB RAM
    min_uptime: '10s',
    max_restarts: 10,
    autorestart: true,

    // Environment
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001
    },

    // Graceful shutdown
    kill_timeout: 5000,
    // wait_ready отключен, т.к. требует модификации кода приложения

    // Логирование
    error_file: '/var/www/floodilka/logs/backend-error.log',
    out_file: '/var/www/floodilka/logs/backend-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
  }]
};

