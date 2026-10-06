// Package outbound owns bounded, pooled Fiber HTTP clients. Instances are immutable
// after construction and safe for concurrent use. No redirects or retries occur.
package outbound

import (
	"context"
	"errors"
	"net"
	"net/http"
	"sync"
	"time"

	fiberclient "github.com/gofiber/fiber/v3/client"
	"github.com/valyala/fasthttp"
)

const (
	AuthLimit     = 64 << 10
	CustomerLimit = 4 << 20
	ProxyLimit    = 32 << 20
)

type exchange struct {
	request  fasthttp.Request
	response fasthttp.Response
}

var exchanges = sync.Pool{New: func() any { return new(exchange) }}

type Client struct{ clients map[int]*fiberclient.Client }
type Response struct {
	StatusCode int
	Header     http.Header
	data       *exchange
}

func (r *Response) Body() []byte { return r.data.response.Body() }

// Release must follow the last body read. Large exchanges are discarded so a rare
// large payload cannot inflate the steady-state pool. Clear PII before reuse.
func (r *Response) Release() {
	e := r.data
	r.data = nil
	large := len(e.request.Body()) > AuthLimit || len(e.response.Body()) > AuthLimit
	clear(e.request.Body())
	clear(e.response.Body())
	e.request.ReleaseBody(AuthLimit)
	e.response.ReleaseBody(AuthLimit)
	e.request.Reset()
	e.response.Reset()
	if !large {
		exchanges.Put(e)
	}
}
func New() *Client {
	c := &Client{clients: make(map[int]*fiberclient.Client, 3)}
	for _, limit := range []int{AuthLimit, CustomerLimit, ProxyLimit} {
		c.clients[limit] = fiberclient.NewWithClient(&fasthttp.Client{
			MaxConnsPerHost: 128, MaxIdleConnDuration: 90 * time.Second,
			ReadTimeout: 15 * time.Second, WriteTimeout: 15 * time.Second,
			MaxResponseBodySize: limit, MaxIdemponentCallAttempts: 1,
			DisablePathNormalizing: true, NoDefaultUserAgentHeader: true,
			DialTimeout: func(addr string, timeout time.Duration) (netConn net.Conn, err error) {
				return fasthttp.DialTimeout(addr, min(timeout, 3*time.Second))
			},
		})
	}
	return c
}
func (c *Client) CloseIdleConnections() {
	for _, client := range c.clients {
		client.CloseIdleConnections()
	}
}
func (c *Client) Request(ctx context.Context, method, url string, headers http.Header, body []byte, limit int) (*Response, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	client := c.clients[limit]
	if client == nil {
		return nil, errors.New("unsupported response limit")
	}
	deadline := time.Now().Add(15 * time.Second)
	if d, ok := ctx.Deadline(); ok && d.Before(deadline) {
		deadline = d
	}
	e := exchanges.Get().(*exchange)
	r := &Response{data: e}
	e.request.SetRequestURI(url)
	e.request.URI().DisablePathNormalizing = true
	e.request.Header.SetMethod(method)
	for k, values := range headers {
		for _, v := range values {
			e.request.Header.Add(k, v)
		}
	}
	e.request.SetBody(body)
	// The synchronous low-level Fiber API preserves raw bytes and avoids a goroutine
	// per call. Cancellation during I/O is bounded by the request's deadline.
	if err := client.DoDeadline(&e.request, &e.response, deadline); err != nil {
		r.Release()
		return nil, err
	}
	if err := ctx.Err(); err != nil {
		r.Release()
		return nil, err
	}
	r.StatusCode = e.response.StatusCode()
	r.Header = make(http.Header)
	e.response.Header.VisitAll(func(k, v []byte) { r.Header.Add(string(k), string(v)) })
	return r, nil
}
