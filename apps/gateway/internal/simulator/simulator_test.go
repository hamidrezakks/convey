package simulator

import (
	"bytes"
	"context"
	"strings"
	"testing"
	"time"
)

func TestLoopbackSimulator(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	var report bytes.Buffer
	if err := Run(ctx, &report); err != nil {
		t.Fatalf("%v\n%s", err, report.String())
	}
	if !strings.Contains(report.String(), "single:") || !strings.Contains(report.String(), "bulk:") {
		t.Fatal("both adapters must run")
	}
	t.Log(report.String())
}
