package model

import "time"

// SensorReading represents a sensor data point
type SensorReading struct {
	ID         uint      `json:"id"`
	DeviceID   string    `json:"device_id"`
	SensorType string    `json:"sensor_type"`
	Value      float64   `json:"value"`
	Unit       string    `json:"unit"`
	Timestamp  time.Time `json:"timestamp"`
}

// Device represents a cultivation chamber device
type Device struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Location    string    `json:"location"`
	IP          string    `json:"ip"`
	LastSeen    time.Time `json:"last_seen"`
	Online      bool      `json:"online"`
	CreatedAt   time.Time `json:"created_at"`
}

// IrrigationLog represents watering activity
type IrrigationLog struct {
	ID        uint      `json:"id"`
	DeviceID  string    `json:"device_id"`
	Duration  int       `json:"duration"` // seconds
	Trigger   string    `json:"trigger"`  // manual, auto, schedule
	Timestamp time.Time `json:"timestamp"`
}

// Cost represents a cost entry
type Cost struct {
	ID           uint      `json:"id"`
	Category     string    `json:"category"`
	Name         string    `json:"name"`
	Quantity     int       `json:"quantity"`
	UnitName     string    `json:"unit_name"`
	UnitPrice    float64   `json:"unit_price"`
	TotalPrice   float64   `json:"total_price"`
	PurchaseDate string    `json:"purchase_date"`
	Supplier     string    `json:"supplier"`
	Notes        string    `json:"notes"`
	CreatedAt    time.Time `json:"created_at"`
}

// CurrentSensorData represents current sensor readings for all sensors
type CurrentSensorData struct {
	DeviceID       string    `json:"device_id"`
	SoilMoisture1  float64   `json:"soil_moisture1"`
	SoilMoisture2  float64   `json:"soil_moisture2"`
	Temperature    float64   `json:"temperature"`
	Humidity       float64   `json:"humidity"`
	Timestamp      time.Time `json:"timestamp"`
}

// StreamConfig represents streaming configuration
type StreamConfig struct {
	Platforms   []PlatformConfig `json:"platforms"`
	Camera      string           `json:"camera"`
	Resolution  string           `json:"resolution"`
	Bitrate     string           `json:"bitrate"`
	EnableCache bool             `json:"enable_cache"`
}

// PlatformConfig represents a single platform configuration
type PlatformConfig struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Enabled bool   `json:"enabled"`
	RTMPUrl string `json:"rtmp_url"`
	RTMPKey string `json:"rtmp_key"`
}

// StreamStatus represents current streaming status
type StreamStatus struct {
	Active    bool       `json:"active"`
	Platform  string     `json:"platform"`
	StartTime *time.Time `json:"start_time"`
	Duration  int        `json:"duration"`
	HLSUrl    string     `json:"hls_url"`
}
