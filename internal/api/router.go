package api

import (
	"github.com/gin-gonic/gin"
	"github.com/mixed/potato/internal/handler"
)

// RegisterRoutes registers all API routes
func RegisterRoutes(router *gin.Engine, h *handler.Handler) {
	api := router.Group("/api")
	{
		// Health check
		api.GET("/health", h.Health)

		// Sensor routes
		sensor := api.Group("/sensor")
		{
			sensor.GET("/:deviceId/current", h.GetCurrentSensorData)
			sensor.GET("/:deviceId/history", h.GetHistoryData)
		}

		// Control routes
		control := api.Group("/control/:deviceId")
		{
			control.POST("/pump", h.ControlPump)
			control.POST("/fan", h.ControlFan)
		}

		// Device routes
		api.GET("/devices", h.GetDevices)

		// Streaming routes
		streaming := api.Group("/streaming")
		{
			streaming.POST("/start", h.StartStreaming)
			streaming.POST("/stop", h.StopStreaming)
			streaming.GET("/status", h.GetStreamingStatus)
			streaming.GET("/recordings", h.GetRecordings)
		}

		// Cost routes
		cost := api.Group("/cost")
		{
			cost.GET("/list", h.GetCosts)
			cost.GET("/summary", h.GetCostSummary)
			cost.POST("", h.AddCost)
			cost.PUT("/:id", h.UpdateCost)
			cost.DELETE("/:id", h.DeleteCost)
		}
	}
}
