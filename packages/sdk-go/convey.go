package convey

import (
	"fmt"
	"net/http"
	"os"
	"runtime"
	"strings"
)

// Client is the primary entry point for communicating with the Convey API.
type Client struct {
	http        *HTTPClient
	Messages    *MessagesResource
	Batches     *BatchesResource
	Suppressions *SuppressionsResource
	Webhooks    *WebhooksResource
	DLQ         *DLQResource
	Sandbox     *SandboxResource
	Reports     *ReportsResource
	Templates   *TemplatesResource
	Preferences *PreferencesResource
	Inbox       *InboxResource
	Admin       *AdminResource
}

// NewClient initializes a production Convey SDK client.
func NewClient(apiKey string, opts ...Option) *Client {
	apiKey = strings.TrimSpace(apiKey)
	if apiKey == "" {
		apiKey = os.Getenv("CONVEY_API_KEY")
	}

	baseURL := os.Getenv("CONVEY_BASE_URL")
	if baseURL == "" {
		baseURL = defaultBaseURL
	}

	isSandbox := strings.HasPrefix(apiKey, "sk_test_")

	httpClient := &http.Client{
		Transport: NewDefaultTransport(),
		Timeout:   defaultTimeout,
	}

	c := &Client{
		http: &HTTPClient{
			baseURL:        baseURL,
			apiKey:         apiKey,
			isSandbox:      isSandbox,
			timeout:        defaultTimeout,
			maxRetries:     defaultMaxRetries,
			httpClient:     httpClient,
			defaultHeaders: make(map[string]string),
			userAgent:      fmt.Sprintf("convey-go/%s (%s; %s)", sdkVersion, runtime.GOOS, runtime.GOARCH),
		},
	}

	for _, opt := range opts {
		opt(c)
	}

	c.Messages = newMessagesResource(c.http)
	c.Batches = newBatchesResource(c.http)
	c.Suppressions = newSuppressionsResource(c.http)
	c.Webhooks = newWebhooksResource(c.http)
	c.DLQ = newDLQResource(c.http)
	c.Sandbox = newSandboxResource(c.http)
	c.Reports = newReportsResource(c.http)
	c.Templates = newTemplatesResource(c.http)
	c.Preferences = newPreferencesResource(c.http)
	c.Inbox = newInboxResource(c.http)
	c.Admin = newAdminResource(c.http)

	return c
}
