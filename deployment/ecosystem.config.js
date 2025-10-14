/**
 * PM2 Ecosystem конфигурация для zero-downtime deployment
 *
 * Использует cluster mode с несколькими инстансами для graceful reload
 */

module.exports = {
  apps: [{
    name: 'floodilka-backend',
    script: './server.js',
    cwd: '/var/www/floodilka/backend',

    // Fork mode - один процесс, проще для WebSocket без Redis
    instances: 1,
    exec_mode: 'fork',

    // Автоматические параметры
    max_memory_restart: '500M',
    min_uptime: '10s', // Минимальное время работы перед рестартом
    max_restarts: 10,
    autorestart: true,

    // Environment
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001
    },

    // Graceful shutdown
    kill_timeout: 5000, // 5 секунд на graceful shutdown
    // wait_ready отключен, т.к. требует модификации кода приложения
    // listen_timeout: 10000, // Таймаут ожидания ready

    // Логирование
    error_file: '/var/www/floodilka/logs/backend-error.log',
    out_file: '/var/www/floodilka/logs/backend-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,

    // Graceful reload
    // При reload PM2 будет запускать новые инстансы,
    // дожидаться их готовности, и только потом убивать старые
    // Все инстансы слушают ОДИН И ТОТ ЖЕ порт 3001
    // Node.js автоматически распределяет нагрузку между ними
  }]
};

