# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Potato** (土豆培育系统) is an IoT-based smart potato cultivation system with:
- Real-time environmental monitoring (humidity, temperature, soil moisture)
- Automatic irrigation control via ESP32
- Web-based dashboard with live streaming
- Interactive control interface
- Data logging and analytics

## Technology Stack

| Component | Technology |
|-----------|------------|
| Backend | Node.js + Express + TypeScript |
| Hardware | ESP32 microcontroller |
| Database | MySQL |
| Frontend | Vanilla HTML/CSS/JS (public/) |
| Camera | ESP32-CAM or USB Camera |
| Communication | MQTT / HTTP REST API |

## Project Structure

```
potato/
├── src/
│   ├── controllers/    # Route handlers for API endpoints
│   ├── services/       # Business logic (sensor data, irrigation control)
│   ├── models/         # Database models (MySQL)
│   ├── routes/         # Express route definitions
│   ├── middleware/     # Auth, validation, error handling
│   ├── config/         # Database, MQTT, hardware config
│   └── types/          # TypeScript type definitions
├── public/             # Static frontend assets
│   ├── css/
│   └── js/
├── esp32/
│   └── firmware/       # ESP32 C++ firmware code
└── docs/               # Hardware setup and API documentation
```

## Common Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build TypeScript
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Upload ESP32 firmware (PlatformIO)
cd esp32/firmware && pio run --target upload
```

## Architecture

### Hardware Communication Flow
```
ESP32 (Sensors + Relays) <--MQTT/HTTP--> Node.js Backend <--REST--> Web Dashboard
```

### Key Components
1. **Sensor Service** - Polls ESP32 for sensor readings (soil moisture, DHT temperature/humidity)
2. **Irrigation Service** - Controls water pump relay based on moisture thresholds
3. **Camera Service** - Manages video streaming (MJPG or WebRTC)
4. **Scheduler Service** - Cron jobs for automated watering cycles

### Database Schema
- `sensor_readings` - Timestamped sensor data (id, device_id, sensor_type, value, timestamp)
- `irrigation_logs` - Water pump activation history
- `devices` - Registered ESP32 devices with configuration
- `schedules` - Automated watering schedules

## ESP32 Pin Configuration (Reference)

| Function | GPIO Pin |
|----------|----------|
| Soil Moisture Sensor | A0/ADC |
| DHT22 Temp/Humidity | GPIO 4 |
| Water Pump Relay | GPIO 12 |
| Status LED | GPIO 2 |

## Hardware Requirements

See `docs/hardware-setup.md` for complete DIY hardware list including:
- ESP32 development board (~$5-10)
- Soil moisture sensors (~$2 each)
- DHT22 temperature/humidity sensor (~$3)
- 5V relay module for pump control (~$2)
- Water pump + tubing (~$10-15)
- Power supply (5V 2A minimum)

## Environment Variables

Create `.env` file:
```
PORT=3000
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DB=potato_system
MQTT_BROKER=mqtt://localhost:1883
CAMERA_STREAM_URL=http://esp32-cam-local-ip/stream
```

## Development Notes

- Use TypeScript strict mode
- Follow RESTful API conventions
- All sensor data must include timestamps
- Implement hardware fail-safes (timeout irrigation, max water limits)
- Support multiple cultivation chambers/zones
