package main

import (
	"log/slog"
	"os"

	"github.com/hamidrezakks/convey/apps/gateway/internal/gateway"
	"go.uber.org/fx"
	"go.uber.org/fx/fxevent"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	fx.New(fx.WithLogger(func() fxevent.Logger { return &fxevent.SlogLogger{Logger: slog.Default()} }), fx.Provide(gateway.LoadConfig, gateway.NewClient, gateway.NewResolver, gateway.NewApp), fx.Invoke(gateway.RegisterLifecycle)).Run()
}
