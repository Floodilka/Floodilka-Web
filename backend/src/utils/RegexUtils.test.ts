/*
 * Copyright (C) 2026 Floodilka Contributors
 *
 * This file is part of Floodilka.
 *
 * Floodilka is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Floodilka is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Floodilka. If not, see <https://www.gnu.org/licenses/>.
 */

import {describe, expect, it} from 'vitest';
import {escapeRegex} from './RegexUtils';

describe('RegexUtils', () => {
	describe('escapeRegex', () => {
		it('should escape special regex characters', () => {
			expect(escapeRegex('.')).toBe('\\.');
			expect(escapeRegex('^')).toBe('\\^');
			expect(escapeRegex('$')).toBe('\\$');
			expect(escapeRegex('*')).toBe('\\*');
			expect(escapeRegex('+')).toBe('\\+');
			expect(escapeRegex('?')).toBe('\\?');
			expect(escapeRegex('(')).toBe('\\(');
			expect(escapeRegex(')')).toBe('\\)');
			expect(escapeRegex('[')).toBe('\\[');
			expect(escapeRegex(']')).toBe('\\]');
			expect(escapeRegex('{')).toBe('\\{');
			expect(escapeRegex('}')).toBe('\\}');
			expect(escapeRegex('|')).toBe('\\|');
			expect(escapeRegex('\\')).toBe('\\\\');
		});

		it('should handle strings with multiple special characters', () => {
			expect(escapeRegex('hello.world')).toBe('hello\\.world');
			expect(escapeRegex('[test]')).toBe('\\[test\\]');
			expect(escapeRegex('(group)')).toBe('\\(group\\)');
			expect(escapeRegex('{min,max}')).toBe('\\{min,max\\}');
			expect(escapeRegex('start^end$')).toBe('start\\^end\\$');
		});

		it('should leave regular characters unchanged', () => {
			expect(escapeRegex('hello')).toBe('hello');
			expect(escapeRegex('world123')).toBe('world123');
			expect(escapeRegex('test_string')).toBe('test_string');
			expect(escapeRegex('email@domain.com')).toBe('email@domain\\.com');
		});

		it('should handle empty string', () => {
			expect(escapeRegex('')).toBe('');
		});

		it('should handle complex patterns', () => {
			const input = '.*+?^$' + '{}' + '[]|()\\\\';
			const expected = '\\.\\*\\+\\?\\^\\$\\{\\}\\[\\]\\|\\(\\)\\\\\\\\';
			expect(escapeRegex(input)).toBe(expected);
		});

		it('should work with regex constructor', () => {
			const userInput = 'test.string*with?special^chars$';
			const escaped = escapeRegex(userInput);
			const regex = new RegExp(escaped);

			expect(regex.test(userInput)).toBe(true);
			expect(regex.test('testXstringYwithZspecialAcharsB')).toBe(false);
		});

		it('should handle whitespace', () => {
			expect(escapeRegex('hello world')).toBe('hello world');
			expect(escapeRegex('tab\there')).toBe('tab\there');
			expect(escapeRegex('new\nline')).toBe('new\nline');
		});

		it('should handle unicode characters', () => {
			expect(escapeRegex('café')).toBe('café');
			expect(escapeRegex('🎉.test')).toBe('🎉\\.test');
			expect(escapeRegex('中文.txt')).toBe('中文\\.txt');
		});

		it('should handle file patterns', () => {
			expect(escapeRegex('*.txt')).toBe('\\*\\.txt');
			expect(escapeRegex('file?.log')).toBe('file\\?\\.log');
			expect(escapeRegex('[abc].csv')).toBe('\\[abc\\]\\.csv');
		});

		it('should make user input safe for regex', () => {
			const dangerousInputs = ['.*', '^$', '[a-z]+', '(test|demo)', '\\d{3}'];

			dangerousInputs.forEach((input) => {
				const escaped = escapeRegex(input);
				const regex = new RegExp(escaped);

				expect(regex.test(input)).toBe(true);

				if (input === '.*') {
					expect(regex.test('anything')).toBe(false);
				}
			});
		});

		it('should preserve string length for non-special chars', () => {
			const input = 'normalstring123';
			expect(escapeRegex(input)).toHaveLength(input.length);
		});

		it('should escape consecutive special characters', () => {
			expect(escapeRegex('...')).toBe('\\.\\.\\.');
			expect(escapeRegex('***')).toBe('\\*\\*\\*');
			expect(escapeRegex('(((')).toBe('\\(\\(\\(');
		});
	});
});
