package config

import (
	"os"
	"strconv"
)

// Config holds application configuration
type Config struct {
	Port        int
	Environment string
	Database    DatabaseConfig
	MQTT        MQTTConfig
	Camera      CameraConfig
}

// DatabaseConfig holds database configuration
type DatabaseConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	Database string
}

// MQTTConfig holds MQTT configuration
type MQTTConfig struct {
	Broker string
	Client string
}

// CameraConfig holds camera configuration
type CameraConfig struct {
	StreamURL1 string
	StreamURL2 string
}

// Load loads configuration from environment variables
func Load() *Config {
	return &Config{
		Port:        getEnvInt("PORT", 7777),
		Environment: getEnv("NODE_ENV", "development"),
		Database: DatabaseConfig{
			Host:     getEnv("MYSQL_HOST", "localhost"),
			Port:     getEnvInt("MYSQL_PORT", 3306),
			User:     getEnv("MYSQL_USER", "root"),
			Password: getEnv("MYSQL_PASSWORD", ""),
			Database: getEnv("MYSQL_DB", "potato_system"),
		},
		MQTT: MQTTConfig{
			Broker: getEnv("MQTT_BROKER", "mqtt://localhost:1883"),
			Client: getEnv("MQTT_CLIENT", "potato-server"),
		},
		Camera: CameraConfig{
			StreamURL1: getEnv("CAMERA_1_URL", "http://192.168.1.101:81/stream"),
			StreamURL2: getEnv("CAMERA_2_URL", "http://192.168.1.102:81/stream"),
		},
	}
}

func getEnv(key string, defaultValue interface{}) string {
	if val := os.Getenv(key); val != "" {
		return val
	}

	switch v := defaultValue.(type) {
	case int:
		return strconv.Itoa(v)
	case string:
		return v
	default:
		return ""
	}
}

func getEnvInt(key string, defaultValue int) int {
	if val := os.Getenv(key); val != "" {
		if intVal, err := strconv.Atoi(val); err == nil {
			return intVal
		}
	}
	return defaultValue
}
