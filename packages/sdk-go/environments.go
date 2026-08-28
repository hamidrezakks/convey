package convey

import (
	"fmt"
	"os"
	"strings"
)

// Standard environment endpoint presets.
const (
	EnvProduction = "https://api.convey.dev"
	EnvUS         = "https://us.api.convey.dev"
	EnvEU         = "https://eu.api.convey.dev"
	EnvStaging    = "https://staging.api.convey.dev"
	EnvLocal      = "http://localhost:3000"
	EnvSandbox    = "https://sandbox.api.convey.dev"
)

// NormalizeBaseURL trims trailing slashes and validates the protocol.
func NormalizeBaseURL(url string) (string, error) {
	trimmed := strings.TrimRight(strings.TrimSpace(url), "/")
	if trimmed == "" {
		return "", &ConfigurationError{BaseError{Message: "base URL cannot be empty"}}
	}
	if !strings.HasPrefix(trimmed, "http://") && !strings.HasPrefix(trimmed, "https://") {
		return "", &ConfigurationError{BaseError{Message: fmt.Sprintf("invalid base URL '%s': must start with http:// or https://", url)}}
	}
	return trimmed, nil
}

// ResolveEnvironmentURL maps an environment preset identifier to its canonical endpoint.
func ResolveEnvironmentURL(env string) (string, error) {
	normalized := strings.ToUpper(strings.TrimSpace(env))
	switch normalized {
	case "PRODUCTION", "PROD", "ENVPRODUCTION":
		return EnvProduction, nil
	case "US", "US_EAST", "US_WEST", "ENVUS":
		return EnvUS, nil
	case "EU", "EU_CENTRAL", "EU_WEST", "ENVEU":
		return EnvEU, nil
	case "STAGING", "STAGE", "ENVSTAGING":
		return EnvStaging, nil
	case "LOCAL", "DEV", "DEVELOPMENT", "ENVLOCAL":
		return EnvLocal, nil
	case "SANDBOX", "TEST", "ENVSANDBOX":
		return EnvSandbox, nil
	default:
		if strings.HasPrefix(env, "http://") || strings.HasPrefix(env, "https://") {
			return NormalizeBaseURL(env)
		}
		return "", &ConfigurationError{BaseError{Message: fmt.Sprintf("unknown Convey environment preset '%s'", env)}}
	}
}

// ResolveBaseURL resolves the effective base URL with strict fail-fast enforcement.
func ResolveBaseURL(baseURL, env string) (string, error) {
	if strings.TrimSpace(baseURL) != "" {
		return NormalizeBaseURL(baseURL)
	}

	if strings.TrimSpace(env) != "" {
		return ResolveEnvironmentURL(env)
	}

	if envVar := os.Getenv("CONVEY_BASE_URL"); strings.TrimSpace(envVar) != "" {
		return NormalizeBaseURL(envVar)
	}

	return "", &ConfigurationError{BaseError{Message: "Convey client requires a valid base URL. Please pass WithBaseURL(), WithEnvironment(), or set CONVEY_BASE_URL environment variable"}}
}
