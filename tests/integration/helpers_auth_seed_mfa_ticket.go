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
	"net/http"
	"testing"
)

func seedMfaTicket(t testing.TB, client *testClient, ticket, userID string, ttlSeconds int) {
	t.Helper()

	resp, err := client.postJSON("/test/auth/mfa-ticket", map[string]any{
		"ticket":      ticket,
		"user_id":     userID,
		"ttl_seconds": ttlSeconds,
	})
	if err != nil {
		t.Fatalf("failed to seed mfa ticket: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("seed mfa ticket returned %d: %s", resp.StatusCode, readResponseBody(resp))
	}
}
