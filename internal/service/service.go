package service

import (
	"log"
	"sync"
	"time"

	"github.com/mixed/potato/internal/config"
	"github.com/mixed/potato/internal/model"
)

// Services holds all service instances
type Services struct {
	Sensor    *SensorService
	Control   *ControlService
	Streaming *StreamingService
	Cost      *CostService
	Device    *DeviceService
}

// New creates all service instances
func New(cfg *config.Config) *Services {
	devices := &DeviceService{
		cfg:    cfg,
		devices: make(map[string]*model.Device),
	}

	return &Services{
		Sensor:    &SensorService{cfg: cfg, devices: devices},
		Control:   &ControlService{cfg: cfg, devices: devices},
		Streaming: &StreamingService{cfg: cfg},
		Cost:      &CostService{},
		Device:    devices,
	}
}

// DeviceService manages device connections and status
type DeviceService struct {
	cfg      *config.Config
	devices  map[string]*model.Device
	mu       sync.RWMutex
}

// GetAll returns all devices
func (s *DeviceService) GetAll() []*model.Device {
	s.mu.RLock()
	defer s.mu.RUnlock()

	devices := make([]*model.Device, 0, len(s.devices))
	for _, d := range s.devices {
		devices = append(devices, d)
	}
	return devices
}

// GetByID returns a device by ID
func (s *DeviceService) GetByID(id string) *model.Device {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.devices[id]
}

// AddOrUpdate adds or updates a device
func (s *DeviceService) AddOrUpdate(device *model.Device) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.devices[device.ID] = device
}

// SensorService handles sensor data
type SensorService struct {
	cfg     *config.Config
	devices *DeviceService
}

// GetCurrentData returns current sensor data for a device
func (s *SensorService) GetCurrentData(deviceID string) *model.CurrentSensorData {
	// Demo mode data
	return &model.CurrentSensorData{
		DeviceID:      deviceID,
		SoilMoisture1: 45.0,
		SoilMoisture2: 42.0,
		Temperature:   24.0,
		Humidity:      65.0,
		Timestamp:     time.Now(),
	}
}

// GetHistoryData returns historical sensor data
func (s *SensorService) GetHistoryData(deviceID string, sensorType string, hours int) []model.SensorReading {
	// Demo mode data
	return []model.SensorReading{
		{
			DeviceID:   deviceID,
			SensorType: sensorType,
			Value:      45.0,
			Unit:       "%",
			Timestamp:  time.Now().Add(-1 * time.Hour),
		},
	}
}

// ControlService handles device controls
type ControlService struct {
	cfg     *config.Config
	devices *DeviceService
}

// ControlPump controls water pump
func (s *ControlService) ControlPump(deviceID, action string, duration int) error {
	log.Printf("[Control] %s pump on device %s (duration: %ds)", action, deviceID, duration)
	return nil
}

// ControlFan controls fan
func (s *ControlService) ControlFan(deviceID, action string) error {
	log.Printf("[Control] %s fan on device %s", action, deviceID)
	return nil
}

// StreamingService handles live streaming
type StreamingService struct {
	cfg        *config.Config
	mu         sync.RWMutex
	active     bool
	startTime  time.Time
	platforms  []model.PlatformConfig
	process    *processWrapper
}

type processWrapper struct {
	// Placeholder for process management
}

// Start starts multi-platform streaming
func (s *StreamingService) Start(config model.StreamConfig) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.active {
		return ErrAlreadyStreaming
	}

	s.active = true
	s.startTime = time.Now()
	s.platforms = config.Platforms

	log.Printf("[Streaming] Started on %d platforms", len(config.Platforms))
	return nil
}

// Stop stops streaming
func (s *StreamingService) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.active {
		return ErrNotStreaming
	}

	s.active = false
	s.platforms = nil

	log.Printf("[Streaming] Stopped")
	return nil
}

// GetStatus returns current streaming status
func (s *StreamingService) GetStatus() *model.StreamStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if !s.active {
		return &model.StreamStatus{
			Active: false,
		}
	}

	duration := int(time.Since(s.startTime).Seconds())

	return &model.StreamStatus{
		Active:    true,
		Platform:  "multi",
		StartTime: &s.startTime,
		Duration:  duration,
		HLSUrl:    "/hls/stream.m3u8",
	}
}

// GetRecordings returns list of recordings
func (s *StreamingService) GetRecordings() []Recording {
	return []Recording{}
}

// Recording represents a video recording
type Recording struct {
	Name    string    `json:"name"`
	Size    string    `json:"size"`
	Date    time.Time `json:"date"`
}

// CostService handles cost management
type CostService struct {
	costs []model.Cost
	mu    sync.RWMutex
}

// GetAll returns all costs
func (s *CostService) GetAll() []model.Cost {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.costs
}

// Add adds a new cost entry
func (s *CostService) Add(cost *model.Cost) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	cost.ID = uint(len(s.costs) + 1)
	cost.CreatedAt = time.Now()
	s.costs = append(s.costs, *cost)
	return nil
}

// Update updates a cost entry
func (s *CostService) Update(id uint, cost *model.Cost) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if int(id) > len(s.costs) {
		return ErrNotFound
	}

	cost.ID = id
	s.costs[id-1] = *cost
	return nil
}

// Delete deletes a cost entry
func (s *CostService) Delete(id uint) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if int(id) > len(s.costs) {
		return ErrNotFound
	}

	s.costs = append(s.costs[:id-1], s.costs[id:]...)
	return nil
}

// GetSummary returns cost summary by category
func (s *CostService) GetSummary() map[string]float64 {
	s.mu.RLock()
	defer s.mu.RUnlock()

	summary := make(map[string]float64)
	for _, cost := range s.costs {
		summary[cost.Category] += cost.TotalPrice
	}
	return summary
}

// Errors
var (
	ErrAlreadyStreaming = &ServiceError{Message: "Streaming is already active"}
	ErrNotStreaming     = &ServiceError{Message: "No active stream"}
	ErrNotFound         = &ServiceError{Message: "Resource not found"}
)

// ServiceError represents a service error
type ServiceError struct {
	Message string
}

func (e *ServiceError) Error() string {
	return e.Message
}
