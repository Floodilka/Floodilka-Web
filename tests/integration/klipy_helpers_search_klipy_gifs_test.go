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

// searchKlipyGIFs searches for GIFs using the Klipy API
// Returns an array of GIF results
func searchKlipyGIFs(t testing.TB, client *testClient, token, query, locale string) []klipyGIF {
	t.Helper()

	url := fmt.Sprintf("/klipy/search?q=%s", query)
	if locale != "" {
		url += fmt.Sprintf("&locale=%s", locale)
	}

	resp, err := client.getWithAuth(url, token)
	if err != nil {
		t.Fatalf("failed to search klipy GIFs: %v", err)
	}
	defer resp.Body.Close()

	assertStatus(t, resp, http.StatusOK)

	var gifs []klipyGIF
	decodeJSONResponse(t, resp, &gifs)

	return gifs
}
