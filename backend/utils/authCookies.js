const config = require('../config/env');

const buildCookieOptions = () => {
  if (!config.jwtCookie.enabled) {
    return null;
  }

  const options = {
    httpOnly: true,
    sameSite: config.jwtCookie.sameSite,
    secure: config.jwtCookie.secure,
    path: config.jwtCookie.path,
    maxAge: config.jwtCookie.maxAge
  };

  if (config.jwtCookie.domain) {
    options.domain = config.jwtCookie.domain;
  }

  if (config.jwtCookie.signed) {
    options.signed = true;
  }

  return options;
};

const buildClearOptions = () => {
  const baseOptions = buildCookieOptions();
  if (!baseOptions) {
    return null;
  }

  const clearOptions = { ...baseOptions };
  delete clearOptions.maxAge;
  clearOptions.expires = new Date(0);
  return clearOptions;
};

const setAuthCookie = (res, token) => {
  const options = buildCookieOptions();
  if (!options) {
    return;
  }

  res.cookie(config.jwtCookie.name, token, options);
};

const clearAuthCookie = (res) => {
  const options = buildClearOptions();
  if (!options) {
    return;
  }

  res.clearCookie(config.jwtCookie.name, options);
};

module.exports = {
  setAuthCookie,
  clearAuthCookie
};
