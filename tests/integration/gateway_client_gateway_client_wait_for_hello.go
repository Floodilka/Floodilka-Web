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
	"testing"
	"time"
)

func (g *gatewayClient) waitForHello(t testing.TB, timeout time.Duration) gatewayHelloPayload {
	t.Helper()
	timer := time.NewTimer(timeout)
	defer timer.Stop()
	select {
	case hello := <-g.helloCh:
		return hello
	case <-timer.C:
		t.Fatalf("timed out waiting for gateway HELLO")
	case err := <-g.errCh:
		t.Fatalf("gateway error before HELLO: %v", err)
	}
	return gatewayHelloPayload{}
}
