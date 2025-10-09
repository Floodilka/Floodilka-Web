/**
 * Обертка для async функций контроллеров
 * Автоматически ловит ошибки и передает их в error middleware
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;

