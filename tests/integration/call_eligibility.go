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
)

// Helper function to get call eligibility
func getCallEligibility(t *testing.T, client *testClient, token string, channelID int64) callEligibilityResponse {
	t.Helper()

	resp, err := client.getWithAuth(fmt.Sprintf("/channels/%d/call", channelID), token)
	if err != nil {
		t.Fatalf("failed to get call eligibility: %v", err)
	}

	var result callEligibilityResponse
	decodeJSONResponse(t, resp, &result)
	return result
}
