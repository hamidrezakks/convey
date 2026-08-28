package convey

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// PollConfig holds configuration parameters for polling awaiters.
type PollConfig struct {
	Interval         time.Duration
	Timeout          time.Duration
	TerminalStatuses []string
	OnPoll           func(interface{})
}

// PollOption is a functional configuration option for polling.
type PollOption func(*PollConfig)

// WithPollInterval sets the interval between status probes.
func WithPollInterval(interval time.Duration) PollOption {
	return func(c *PollConfig) {
		c.Interval = interval
	}
}

// WithPollTimeout sets the maximum timeout duration before aborting.
func WithPollTimeout(timeout time.Duration) PollOption {
	return func(c *PollConfig) {
		c.Timeout = timeout
	}
}

// WithTerminalStatuses sets custom terminal statuses to wait for.
func WithTerminalStatuses(statuses ...string) PollOption {
	return func(c *PollConfig) {
		c.TerminalStatuses = statuses
	}
}

// WithOnPoll sets a callback invoked on each probe.
func WithOnPoll(callback func(interface{})) PollOption {
	return func(c *PollConfig) {
		c.OnPoll = callback
	}
}

// WaitForDelivery polls message status until terminal delivery (DELIVERED, FAILED, SUPPRESSED) or deadline.
func (m *MessagesResource) WaitForDelivery(ctx context.Context, messageID string, opts ...PollOption) (*MessageDetailDto, error) {
	cfg := &PollConfig{
		Interval:         500 * time.Millisecond,
		Timeout:          30 * time.Second,
		TerminalStatuses: []string{string(StatusDelivered), string(StatusFailed), string(StatusSuppressed)},
	}
	for _, opt := range opts {
		opt(cfg)
	}

	ctx, cancel := context.WithTimeout(ctx, cfg.Timeout)
	defer cancel()

	ticker := time.NewTicker(cfg.Interval)
	defer ticker.Stop()

	for {
		msg, err := m.Get(ctx, messageID)
		if err != nil {
			return nil, err
		}

		if cfg.OnPoll != nil {
			cfg.OnPoll(msg)
		}

		statusUpper := strings.ToUpper(string(msg.Status))
		for _, term := range cfg.TerminalStatuses {
			if strings.ToUpper(term) == statusUpper {
				return msg, nil
			}
		}

		select {
		case <-ctx.Done():
			return nil, &TimeoutError{
				BaseError: BaseError{Message: fmt.Sprintf("message '%s' did not reach terminal status within %v", messageID, cfg.Timeout)},
				TimeoutMs: int(cfg.Timeout.Milliseconds()),
			}
		case <-ticker.C:
		}
	}
}

// WaitForCompletion polls batch state until terminal completion (COMPLETED, CANCELLED) or deadline.
func (b *BatchesResource) WaitForCompletion(ctx context.Context, batchID string, opts ...PollOption) (*BatchDto, error) {
	cfg := &PollConfig{
		Interval: 1 * time.Second,
		Timeout:  60 * time.Second,
	}
	for _, opt := range opts {
		opt(cfg)
	}

	ctx, cancel := context.WithTimeout(ctx, cfg.Timeout)
	defer cancel()

	ticker := time.NewTicker(cfg.Interval)
	defer ticker.Stop()

	for {
		batch, err := b.Get(ctx, batchID)
		if err != nil {
			return nil, err
		}

		if cfg.OnPoll != nil {
			cfg.OnPoll(batch)
		}

		stateUpper := strings.ToUpper(string(batch.State))
		if stateUpper == string(BatchStateCompleted) || stateUpper == string(BatchStateCancelled) {
			return batch, nil
		}

		select {
		case <-ctx.Done():
			return nil, &TimeoutError{
				BaseError: BaseError{Message: fmt.Sprintf("batch '%s' did not complete within %v", batchID, cfg.Timeout)},
				TimeoutMs: int(cfg.Timeout.Milliseconds()),
			}
		case <-ticker.C:
		}
	}
}
