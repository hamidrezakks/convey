package outbound

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestLimitsDeadlinesAndReuse(t *testing.T) {
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/large":
			w.Write([]byte(strings.Repeat("x", AuthLimit+1)))
		case "/slow":
			time.Sleep(100 * time.Millisecond)
			w.Write([]byte("late"))
		default:
			io.Copy(w, r.Body)
		}
	}))
	defer s.Close()
	c := New()
	defer c.CloseIdleConnections()
	for i := range 50 {
		body := []byte("private-message")
		r, err := c.Request(context.Background(), "POST", s.URL, nil, body, AuthLimit)
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal(r.Body(), body) {
			t.Fatalf("reuse corruption at %d", i)
		}
		copyOfBody := append([]byte(nil), r.Body()...)
		r.Release()
		if !bytes.Equal(copyOfBody, body) {
			t.Fatal("ownership")
		}
	}
	if r, err := c.Request(context.Background(), "GET", s.URL+"/large", nil, nil, AuthLimit); err == nil {
		r.Release()
		t.Fatal("oversize response accepted")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()
	start := time.Now()
	if r, err := c.Request(ctx, "GET", s.URL+"/slow", nil, nil, AuthLimit); err == nil {
		r.Release()
		t.Fatal("deadline ignored")
	}
	if time.Since(start) > 80*time.Millisecond {
		t.Fatal("deadline was not bounded")
	}
}
func TestNoRetryAndRedirect(t *testing.T) {
	var calls atomic.Int32
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.URL.Path == "/redirect" {
			http.Redirect(w, r, "/target", 302)
			return
		}
		conn, _, _ := w.(http.Hijacker).Hijack()
		conn.Close()
	}))
	defer s.Close()
	c := New()
	defer c.CloseIdleConnections()
	r, err := c.Request(context.Background(), "GET", s.URL+"/redirect", nil, nil, AuthLimit)
	if err != nil {
		t.Fatal(err)
	}
	if r.StatusCode != 302 || calls.Load() != 1 {
		t.Fatal("redirect followed")
	}
	r.Release()
	calls.Store(0)
	_, err = c.Request(context.Background(), "POST", s.URL+"/disconnect", http.Header{"Idempotency-Key": []string{"k"}}, []byte("body"), AuthLimit)
	if err == nil || calls.Load() != 1 {
		t.Fatalf("ambiguous POST replayed: %d %v", calls.Load(), err)
	}
}
func TestOversizedPoolBufferRetired(t *testing.T) {
	e := new(exchange)
	e.request.SetBody(make([]byte, CustomerLimit))
	e.response.SetBody(make([]byte, CustomerLimit))
	r := &Response{data: e}
	r.Release()
	if cap(e.request.Body()) > AuthLimit || cap(e.response.Body()) > AuthLimit {
		t.Fatal("large backing buffers retained")
	}
}
func BenchmarkOutbound(b *testing.B) {
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"email":"mock@example.test","phone":"+12025550101"}`))
	}))
	defer s.Close()
	b.Run("net-http", func(b *testing.B) {
		c := &http.Client{Transport: &http.Transport{MaxIdleConnsPerHost: 128}}
		defer c.CloseIdleConnections()
		b.ReportAllocs()
		for range b.N {
			r, err := c.Get(s.URL)
			if err != nil {
				b.Fatal(err)
			}
			io.Copy(io.Discard, r.Body)
			r.Body.Close()
		}
	})
	b.Run("fiber-pooled", func(b *testing.B) {
		c := New()
		defer c.CloseIdleConnections()
		b.ReportAllocs()
		for range b.N {
			r, err := c.Request(context.Background(), "GET", s.URL, nil, nil, AuthLimit)
			if err != nil {
				b.Fatal(err)
			}
			r.Release()
		}
	})
}
