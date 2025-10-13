const DEFAULT_TTL_MS = 30_000;

const store = new Map();

const now = () => Date.now();

function set(key, value, ttlMs = DEFAULT_TTL_MS) {
  if (!key) return;
  const expiresAt = ttlMs > 0 ? now() + ttlMs : null;
  store.set(key, { value, expiresAt });
}

function get(key) {
  const entry = store.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt && entry.expiresAt < now()) {
    store.delete(key);
    return null;
  }

  return entry.value;
}

function del(key) {
  store.delete(key);
}

function wrap(key, ttlMs, fn) {
  const cached = get(key);
  if (cached !== null && cached !== undefined) {
    return cached;
  }
  const value = fn();
  if (value instanceof Promise) {
    return value.then((resolved) => {
      set(key, resolved, ttlMs);
      return resolved;
    });
  }
  set(key, value, ttlMs);
  return value;
}

module.exports = {
  get,
  set,
  del,
  wrap
};
