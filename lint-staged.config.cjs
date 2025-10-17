module.exports = {
  '*.{js,jsx,ts,tsx}': ['eslint --max-warnings=0', 'prettier --write'],
  '*.{json,md,css,scss,yml,yaml}': ['prettier --write']
};
