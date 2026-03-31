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

import argon2 from 'argon2';
import bcrypt from 'bcrypt';

export async function hashPassword(password: string): Promise<string> {
	return argon2.hash(password);
}

function isBcryptHash(hash: string): boolean {
	return hash.startsWith('$2b$') || hash.startsWith('$2a$');
}

export function needsRehash(passwordHash: string): boolean {
	return isBcryptHash(passwordHash);
}

export async function verifyPassword({
	password,
	passwordHash,
}: {
	password: string;
	passwordHash: string;
}): Promise<boolean> {
	if (isBcryptHash(passwordHash)) {
		return bcrypt.compare(password, passwordHash);
	}
	return argon2.verify(passwordHash, password);
}
