package gateway

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/hamidrezakks/convey/apps/gateway/internal/customer"
)

type object map[string]json.RawMessage

func str(v json.RawMessage) string { var s string; _ = json.Unmarshal(v, &s); return s }
func present(v json.RawMessage) bool {
	s := strings.TrimSpace(string(v))
	return s != "" && s != "null" && s != "\"\"" && s != "[]" && s != "{}"
}

var fields = map[string]string{"email": "email", "sms": "phone", "whatsapp": "whatsapp", "telegram": "telegramChatId", "slack": "slack", "fcm": "fcmTokens", "apns": "apnsTokens"}

func required(m object) ([]string, error) {
	var channels []object
	if json.Unmarshal(m["channels"], &channels) != nil || len(channels) == 0 {
		return nil, errors.New("channels must be a nonempty array")
	}
	if present(m["fallback"]) {
		var f struct {
			Rules []struct {
				Send []object `json:"send"`
			} `json:"rules"`
		}
		if json.Unmarshal(m["fallback"], &f) != nil {
			return nil, errors.New("invalid fallback")
		}
		for _, r := range f.Rules {
			channels = append(channels, r.Send...)
		}
	}
	if present(m["cascade"]) {
		var c struct {
			Steps []object `json:"steps"`
		}
		if json.Unmarshal(m["cascade"], &c) != nil {
			return nil, errors.New("invalid cascade")
		}
		channels = append(channels, c.Steps...)
	}
	seen := map[string]bool{}
	var result []string
	for _, c := range channels {
		field, ok := fields[str(c["channel"])]
		if !ok {
			return nil, errors.New("unsupported channel")
		}
		if !seen[field] {
			seen[field] = true
			result = append(result, field)
		}
	}
	return result, nil
}

// enrich validates the full batch before lookup, deduplicates IDs, and only fills
// absent recipient fields. Unknown message fields remain losslessly encoded.
func enrich(ctx context.Context, resolver customer.Resolver, scope customer.Scope, body []byte, bulk bool) ([]byte, error) {
	var messages []object
	var envelope object
	bare := false
	if bulk {
		if len(strings.TrimSpace(string(body))) > 0 && strings.TrimSpace(string(body))[0] == '[' {
			bare = true
			if json.Unmarshal(body, &messages) != nil {
				return nil, invalid("invalid bulk JSON")
			}
		} else {
			if json.Unmarshal(body, &envelope) != nil || json.Unmarshal(envelope["messages"], &messages) != nil {
				return nil, invalid("invalid bulk JSON")
			}
		}
		if len(messages) < 1 || len(messages) > 500 {
			return nil, invalid("bulk requires 1 to 500 messages")
		}
	} else {
		var m object
		if json.Unmarshal(body, &m) != nil || m == nil {
			return nil, invalid("invalid message JSON")
		}
		messages = []object{m}
	}
	contacts := make([]customer.Recipients, len(messages))
	needs := make([][]string, len(messages))
	var ids []string
	seen := map[string]bool{}
	for i, m := range messages {
		if m == nil {
			return nil, invalid("invalid message")
		}
		team := str(m["team"])
		if team != "" && team != scope.Team {
			return nil, &failure{403, "FORBIDDEN", "message team does not match credential"}
		}
		if team == "" {
			m["team"], _ = json.Marshal(scope.Team)
		}
		id := str(m["userId"])
		if strings.TrimSpace(id) == "" || len(id) > 512 {
			return nil, invalid("userId is required and must be at most 512 bytes")
		}
		if str(m["idempotencyKey"]) == "" {
			return nil, invalid("idempotencyKey is required")
		}
		if present(m["recipients"]) {
			if json.Unmarshal(m["recipients"], &contacts[i]) != nil || contacts[i] == nil {
				return nil, invalid("recipients must be an object")
			}
		} else {
			contacts[i] = customer.Recipients{}
		}
		fs, err := required(m)
		if err != nil {
			return nil, invalid(err.Error())
		}
		for _, f := range fs {
			if !present(contacts[i][f]) {
				needs[i] = append(needs[i], f)
			}
		}
		if len(needs[i]) > 0 && !seen[id] {
			ids = append(ids, id)
			seen[id] = true
		}
	}
	resolved := map[string]customer.Recipients{}
	if len(ids) > 0 {
		var err error
		resolved, err = resolver.Resolve(ctx, scope, ids)
		if err != nil {
			if errors.Is(err, customer.ErrNotFound) {
				return nil, &failure{422, "RECIPIENT_NOT_FOUND", "customer could not be resolved"}
			}
			return nil, &failure{502, "CUSTOMER_UNAVAILABLE", "customer lookup failed"}
		}
	}
	for i, m := range messages {
		for _, f := range needs[i] {
			v := resolved[str(m["userId"])][f]
			if !validRecipient(f, v) {
				return nil, &failure{422, "RECIPIENT_MISSING", fmt.Sprintf("customer has no usable %s", f)}
			}
			contacts[i][f] = v
		}
		m["recipients"], _ = json.Marshal(contacts[i])
	}
	if !bulk {
		return json.Marshal(messages[0])
	}
	if bare {
		return json.Marshal(messages)
	}
	envelope["messages"], _ = json.Marshal(messages)
	return json.Marshal(envelope)
}
func validRecipient(field string, v json.RawMessage) bool {
	if !present(v) {
		return false
	}
	switch field {
	case "fcmTokens", "apnsTokens":
		var values []string
		if json.Unmarshal(v, &values) != nil || len(values) == 0 {
			return false
		}
		for _, v := range values {
			if strings.TrimSpace(v) == "" {
				return false
			}
		}
		return true
	case "slack":
		var s struct {
			ChannelID string `json:"channelId"`
		}
		return json.Unmarshal(v, &s) == nil && s.ChannelID != ""
	default:
		return strings.TrimSpace(str(v)) != ""
	}
}
