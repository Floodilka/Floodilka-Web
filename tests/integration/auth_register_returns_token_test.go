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

package integration

import (
	"fmt"
	"testing"
	"time"
)

func TestAuthRegisterReturnsToken(t *testing.T) {
	client := newTestClient(t)

	email := fmt.Sprintf("integration-register-%d@example.com", time.Now().UnixNano())
	password := uniquePassword()

	resp := registerTestUser(t, client, email, password)
	if resp.Token == "" {
		t.Fatalf("expected non-empty token in register response")
	}
	if resp.UserID == "" {
		t.Fatalf("expected non-empty user_id in register response")
	}
}
