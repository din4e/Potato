package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mixed/potato/internal/api"
	"github.com/mixed/potato/internal/config"
	"github.com/mixed/potato/internal/handler"
	"github.com/mixed/potato/internal/middleware"
	"github.com/mixed/potato/internal/service"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Initialize services
	services := service.New(cfg)

	// Setup router
	router := setupRouter(cfg, services)

	// Create HTTP server
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		log.Printf("🥔 Potato Cultivation System Server")
		log.Printf("=======================================")
		log.Printf("Server running on http://localhost:%d", cfg.Port)
		log.Printf("Dashboard: http://localhost:%d", cfg.Port)
		log.Printf("Environment: %s", cfg.Environment)
		log.Printf("=======================================")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}

func setupRouter(cfg *config.Config, services *service.Services) *gin.Engine {
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	// Middleware
	router.Use(middleware.Logger())
	router.Use(middleware.Recovery())
	router.Use(middleware.CORS())
	router.Use(middleware.Static("/public", "./public"))

	// API handlers
	h := handler.New(services)

	// API routes
	api.RegisterRoutes(router, h)

	// Serve index.html for root path
	router.GET("/", func(c *gin.Context) {
		c.File("./public/index.html")
	})

	return router
}
