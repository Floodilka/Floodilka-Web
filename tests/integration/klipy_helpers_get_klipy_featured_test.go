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
	"net/http"
	"testing"
)

// getKlipyFeatured gets featured GIFs from Klipy
// The actual response structure depends on the Klipy API, returning as-is
func getKlipyFeatured(t testing.TB, client *testClient, token, locale string) map[string]any {
	t.Helper()

	url := "/klipy/featured"
	if locale != "" {
		url += fmt.Sprintf("?locale=%s", locale)
	}

	resp, err := client.getWithAuth(url, token)
	if err != nil {
		t.Fatalf("failed to get klipy featured: %v", err)
	}
	defer resp.Body.Close()

	assertStatus(t, resp, http.StatusOK)

	var featured map[string]any
	decodeJSONResponse(t, resp, &featured)

	return featured
}
