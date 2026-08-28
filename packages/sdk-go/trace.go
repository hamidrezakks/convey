package convey

import (
	"crypto/rand"
	"encoding/hex"
	"strings"
)

// GenerateTraceparent creates a new W3C distributed traceparent header.
// Format: version-traceId-parentId-traceFlags (e.g. 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01)
func GenerateTraceparent() string {
	var traceIDBytes [16]byte
	var parentIDBytes [8]byte

	_, _ = rand.Read(traceIDBytes[:])
	_, _ = rand.Read(parentIDBytes[:])

	traceID := hex.EncodeToString(traceIDBytes[:])
	parentID := hex.EncodeToString(parentIDBytes[:])

	return "00-" + traceID + "-" + parentID + "-01"
}

// CreateChildTraceparent derives a child traceparent preserving the root trace ID.
func CreateChildTraceparent(parent string) string {
	parts := strings.Split(parent, "-")
	if len(parts) != 4 || parts[0] != "00" {
		return GenerateTraceparent()
	}

	traceID := parts[1]
	flags := parts[3]

	var spanIDBytes [8]byte
	_, _ = rand.Read(spanIDBytes[:])
	newSpanID := hex.EncodeToString(spanIDBytes[:])

	return "00-" + traceID + "-" + newSpanID + "-" + flags
}
