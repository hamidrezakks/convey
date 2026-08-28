package convey

import (
	"sync"
	"time"
)

// RateLimiter paces outbound requests with token bucket smoothing.
type RateLimiter struct {
	rate         float64
	capacity     float64
	tokens       float64
	lastRefill   time.Time
	mu           sync.Mutex
}

// NewRateLimiter creates a new rate limiter with requests per second and burst capacity.
func NewRateLimiter(rps float64, burst int) *RateLimiter {
	if rps <= 0 {
		rps = 50
	}
	cap := float64(burst)
	if cap <= 0 {
		cap = rps
	}
	return &RateLimiter{
		rate:       rps,
		capacity:   cap,
		tokens:     cap,
		lastRefill: time.Now(),
	}
}

// Wait blocks until a token is available or context is cancelled.
func (r *RateLimiter) Wait() {
	for {
		r.mu.Lock()
		now := time.Now()
		elapsed := now.Sub(r.lastRefill).Seconds()
		r.tokens = r.tokens + elapsed*r.rate
		if r.tokens > r.capacity {
			r.tokens = r.capacity
		}
		r.lastRefill = now

		if r.tokens >= 1.0 {
			r.tokens -= 1.0
			r.mu.Unlock()
			return
		}

		needed := 1.0 - r.tokens
		sleepSec := needed / r.rate
		r.mu.Unlock()

		time.Sleep(time.Duration(sleepSec * float64(time.Second)))
	}
}
