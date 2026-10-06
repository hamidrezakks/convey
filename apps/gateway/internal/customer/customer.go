// Package customer defines the boundary between Convey and a customer directory.
package customer

import (
	"context"
	"encoding/json"
)

type Scope struct {
	TenantID string `json:"tenantId"`
	Team     string `json:"team"`
	Sandbox  bool   `json:"isSandbox"`
}

// Recipients contains only Convey delivery addresses, never a complete customer profile.
type Recipients map[string]json.RawMessage

// Resolver must authorize every lookup for the supplied verified scope. Implementations
// return one entry per requested ID or an error, and must respect ctx cancellation.
// ErrNotFound may accompany partial results; the batcher distributes those only
// to submissions whose complete ID set was found. Other errors fail the chunk.
// Gateway calls it once per submission with unique IDs. Implementations may use a
// native bulk endpoint, bounded single lookups, gRPC, or another customer protocol.
type Resolver interface {
	Resolve(ctx context.Context, scope Scope, userIDs []string) (map[string]Recipients, error)
}
