import {defineConfig} from 'vitest/config';
import path from 'path';

export default defineConfig({
	test: {
		globals: true,
		include: ['src/**/*.test.ts', 'services/**/*.test.js'],
	},
	resolve: {
		alias: {
			'~': path.resolve(__dirname, './src'),
		},
	},
});
