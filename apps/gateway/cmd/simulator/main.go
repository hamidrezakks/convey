package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/hamidrezakks/convey/apps/gateway/internal/simulator"
)

func main() {
	serve := flag.Bool("serve", false, "keep a local gateway and mock services running for manual requests")
	mode := flag.String("mode", "single", "customer lookup mode for --serve: single or bulk")
	flag.Parse()
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError})))
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	if *serve {
		h, err := simulator.Start(*mode)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		fmt.Printf("Mock gateway: %s\nBearer token: demo-key (fake, local only)\nUsers: alice, bob, email-only\nFault IDs: missing, unavailable, malformed, wrong-scope, slow\nCtrl-C stops all three listeners. No vendor sends occur.\n", h.URL)
		<-ctx.Done()
		h.Close()
		return
	}
	if err := simulator.Run(ctx, os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
