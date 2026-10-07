package gateway

import (
	"fmt"
	"net/url"
	"os"
	"time"
)

type Config struct {
	Listen        string
	ConveyURL     string
	CustomerURL   string
	CustomerToken string
	CustomerMode  string
	CustomerPath  string
	Timeout       time.Duration
	BatchWait     time.Duration
}

func LoadConfig() (Config, error) {
	c := Config{Listen: env("GATEWAY_LISTEN", ":8080"), ConveyURL: os.Getenv("CONVEY_URL"), CustomerURL: os.Getenv("CUSTOMER_URL"), CustomerToken: os.Getenv("CUSTOMER_TOKEN"), CustomerMode: env("CUSTOMER_LOOKUP_MODE", "bulk"), Timeout: 15 * time.Second}
	c.BatchWait = 300 * time.Millisecond
	if raw := os.Getenv("CUSTOMER_BATCH_WAIT"); raw != "" {
		wait, err := time.ParseDuration(raw)
		if err != nil || wait < 0 || wait > time.Second {
			return c, fmt.Errorf("CUSTOMER_BATCH_WAIT must be between 0s and 1s")
		}
		c.BatchWait = wait
	}
	c.CustomerPath = env("CUSTOMER_LOOKUP_PATH", "/v1/customers/{userId}")
	if c.CustomerMode == "bulk" {
		c.CustomerPath = env("CUSTOMER_LOOKUP_PATH", "/v1/customers/resolve")
	}
	if c.CustomerMode != "single" && c.CustomerMode != "bulk" {
		return c, fmt.Errorf("CUSTOMER_LOOKUP_MODE must be single or bulk")
	}
	for name, raw := range map[string]string{"CONVEY_URL": c.ConveyURL, "CUSTOMER_URL": c.CustomerURL} {
		u, err := url.Parse(raw)
		if err != nil || u == nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || (u.Path != "" && u.Path != "/") {
			return c, fmt.Errorf("%s must be an HTTP(S) origin without credentials, path or query", name)
		}
	}
	return c, nil
}
func env(name, fallback string) string {
	if v := os.Getenv(name); v != "" {
		return v
	}
	return fallback
}
