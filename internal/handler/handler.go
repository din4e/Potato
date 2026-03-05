package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mixed/potato/internal/model"
	"github.com/mixed/potato/internal/service"
)

// Handler holds all handlers
type Handler struct {
	services *service.Services
}

// New creates a new handler
func New(services *service.Services) *Handler {
	return &Handler{
		services: services,
	}
}

// Health returns health status
func (h *Handler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"service": "potato-cultivation-system",
		"time":    time.Now().Format(time.RFC3339),
	})
}

// GetCurrentSensorData returns current sensor readings
func (h *Handler) GetCurrentSensorData(c *gin.Context) {
	deviceID := c.Param("deviceId")
	data := h.services.Sensor.GetCurrentData(deviceID)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
	})
}

// GetHistoryData returns historical sensor data
func (h *Handler) GetHistoryData(c *gin.Context) {
	deviceID := c.Param("deviceId")
	sensorType := c.DefaultQuery("type", "soil_moisture")
	hours, _ := strconv.Atoi(c.DefaultQuery("hours", "24"))

	data := h.services.Sensor.GetHistoryData(deviceID, sensorType, hours)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
	})
}

// GetDevices returns all devices
func (h *Handler) GetDevices(c *gin.Context) {
	devices := h.services.Device.GetAll()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    devices,
	})
}

// ControlPump controls water pump
func (h *Handler) ControlPump(c *gin.Context) {
	deviceID := c.Param("deviceId")

	var req struct {
		Action   string `json:"action"`
		Duration int    `json:"duration"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request body",
		})
		return
	}

	if err := h.services.Control.ControlPump(deviceID, req.Action, req.Duration); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Pump control executed",
	})
}

// ControlFan controls fan
func (h *Handler) ControlFan(c *gin.Context) {
	deviceID := c.Param("deviceId")

	var req struct {
		Action string `json:"action"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request body",
		})
		return
	}

	if err := h.services.Control.ControlFan(deviceID, req.Action); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Fan control executed",
	})
}

// StartStreaming starts multi-platform streaming
func (h *Handler) StartStreaming(c *gin.Context) {
	var config model.StreamConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request body",
		})
		return
	}

	if err := h.services.Streaming.Start(config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Streaming started",
	})
}

// StopStreaming stops streaming
func (h *Handler) StopStreaming(c *gin.Context) {
	if err := h.services.Streaming.Stop(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Streaming stopped",
	})
}

// GetStreamingStatus returns streaming status
func (h *Handler) GetStreamingStatus(c *gin.Context) {
	status := h.services.Streaming.GetStatus()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    status,
	})
}

// GetRecordings returns list of recordings
func (h *Handler) GetRecordings(c *gin.Context) {
	recordings := h.services.Streaming.GetRecordings()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    recordings,
	})
}

// GetCosts returns all costs
func (h *Handler) GetCosts(c *gin.Context) {
	costs := h.services.Cost.GetAll()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    costs,
	})
}

// GetCostSummary returns cost summary
func (h *Handler) GetCostSummary(c *gin.Context) {
	summary := h.services.Cost.GetSummary()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    summary,
	})
}

// AddCost adds a new cost entry
func (h *Handler) AddCost(c *gin.Context) {
	var cost model.Cost
	if err := c.ShouldBindJSON(&cost); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request body",
		})
		return
	}

	if err := h.services.Cost.Add(&cost); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    cost,
	})
}

// UpdateCost updates a cost entry
func (h *Handler) UpdateCost(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)

	var cost model.Cost
	if err := c.ShouldBindJSON(&cost); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request body",
		})
		return
	}

	if err := h.services.Cost.Update(uint(id), &cost); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    cost,
	})
}

// DeleteCost deletes a cost entry
func (h *Handler) DeleteCost(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)

	if err := h.services.Cost.Delete(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Cost deleted",
	})
}
