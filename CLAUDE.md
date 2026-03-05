# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Potato** (土豆培育系统) is an IoT-based smart potato cultivation system with:
- Real-time environmental monitoring (humidity, temperature, soil moisture)
- Automatic irrigation control via ESP32
- Web-based dashboard with live streaming
- **Multi-platform live streaming** (B站/抖音/YouTube/快手)
- Interactive control interface
- Data logging and analytics
- Cost tracking and reporting

## Technology Stack

| Component | Technology |
|-----------|------------|
| Backend | Node.js + Express + TypeScript |
| Hardware | ESP32 microcontroller |
| Database | MySQL (optional, Demo mode supported) |
| Frontend | Tailwind CSS + Vanilla JS |
| Camera | ESP32-CAM or USB Camera |
| Streaming | FFmpeg + HLS + RTMP |
| Communication | MQTT / HTTP REST API |
| Notifications | Nodemailer + Feishu Webhook |

## Project Structure

```
potato/
├── src/
│   ├── controllers/    # Route handlers (API endpoints)
│   ├── services/       # Business logic
│   │   ├── streamingService.ts    # Multi-platform streaming
│   │   ├── healthMonitoringService.ts
│   │   ├── notificationService.ts
│   │   └── reportingService.ts
│   ├── models/         # Database models
│   ├── routes/         # Express route definitions
│   ├── config/         # Database, MQTT config
│   ├── types/          # TypeScript type definitions
│   └── utils/          # Logger, utilities
├── public/             # Frontend assets
│   ├── css/
│   ├── js/
│   └── index.html
├── esp32/
│   └── firmware/       # ESP32 C++ firmware
├── docs/               # Documentation
│   ├── streaming-guide.md
│   ├── hardware-detailed.md
│   └── TODO.md
└── recordings/         # Local video recordings
```

## Common Commands

```bash
# Install dependencies
npm install

# Run development server (default port: 3000)
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

### System Architecture
```
┌─────────────┐     WiFi/MQTT      ┌─────────────┐
│   ESP32     │ ←─────────────────→ │   Node.js   │
│  + Sensors  │                    │   Backend   │
│  + Camera   │                    │  (Express)  │
└─────────────┘                    └──────┬──────┘
                                          │
                                   ┌──────┴──────┐
                                   │   MySQL DB  │
                                   └─────────────┘
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    │                                           │
            ┌───────┴────────┐                      ┌────────┴────────┐
            │  Web Dashboard  │                      │  FFmpeg Stream  │
            │  (Tailwind)     │                      │   (Multi-RTMP)  │
            └─────────────────┘                      └─────────────────┘
                            │                                   │
                    ┌───────┴──────────────────────────────────────┐
                    │                                             │
                    ▼                                             ▼
            ┌───────────────┐                           ┌───────────────┐
            │  Web Browser  │                           │  Live Platforms│
            │               │                           │  B站/抖音/YT   │
            └───────────────┘                           └───────────────┘
```

### Key Components

| Service | File | Description |
|---------|------|-------------|
| Sensor Service | `sensorController.ts` | Handles sensor data from ESP32 |
| Control Service | `controlController.ts` | Pump/fan control via MQTT |
| Streaming Service | `streamingService.ts` | **Multi-platform RTMP streaming** |
| Health Monitoring | `healthMonitoringService.ts` | Device offline detection |
| Notification Service | `notificationService.ts` | Email + Feishu alerts |
| Reporting Service | `reportingService.ts` | Daily/weekly reports |
| Cost Model | `costModel.ts` | Cost tracking and analysis |

### Database Schema

- `sensor_readings` - Timestamped sensor data (id, device_id, sensor_type, value, timestamp)
- `irrigation_logs` - Water pump activation history
- `devices` - Registered ESP32 devices with configuration
- `schedules` - Automated watering schedules
- `costs` - Hardware and supply cost tracking

## ESP32 Pin Configuration

| Function | GPIO Pin | Description |
|----------|----------|-------------|
| Soil Moisture 1 | GPIO 34 | ADC input ( Capacitive sensor) |
| Soil Moisture 2 | GPIO 35 | ADC input ( Capacitive sensor) |
| DHT22 Temp/Humidity | GPIO 4 | Digital I2C |
| Water Pump Relay | GPIO 12 | Output (Low trigger) |
| Fan Relay | GPIO 14 | Output (Low trigger) |
| Status LED | GPIO 2 | Built-in LED |

## Hardware Requirements

See `docs/hardware-detailed.md` for complete DIY hardware list:

| Component | Qty | Price |
|-----------|-----|-------|
| ESP32-WROOM-32 | 1 | ¥18 |
| ESP32-CAM | 1 | ¥25 |
| Capacitive Soil Sensor | 2 | ¥8 |
| DHT22 Sensor | 1 | ¥5 |
| 5V Relay Module | 2 | ¥6 |
| Mini Water Pump | 1 | ¥12 |
| USB Camera (for streaming) | 1 | ¥50-100 |
| **Total** | | **~¥150-250** |

## Environment Variables

Create `.env` file:
```bash
# Server
PORT=3000
NODE_ENV=development

# MySQL (optional - runs in Demo mode if not available)
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DB=potato_system

# MQTT Broker
MQTT_BROKER=mqtt://localhost:1883

# Camera Streams (ESP32-CAM)
CAMERA_1_URL=http://192.168.1.101:81/stream
CAMERA_2_URL=http://192.168.1.102:81/stream

# Alert Thresholds
SOIL_MOISTURE_MIN=30
TEMPERATURE_MAX=35

# Notifications (Email + Feishu)
NOTIFICATIONS_ENABLED=true
EMAIL_ENABLED=false
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
FEISHU_WEBHOOK=https://open.feishu.cn/xxx
```

## Multi-Platform Streaming

### Supported Platforms

- **B站** (bilibili) - `rtmp://live-push.bilivideo.com/live-bvc/`
- **抖音** (douyin) - `rtmp://push.douyin.com/live/`
- **YouTube Live** - `rtmp://a.rtmp.youtube.com/live2/`
- **快手** (kuaishou) - `rtmp://push.kuaishou.com/live/`

### Requirements

```bash
# FFmpeg must be installed
ffmpeg -version

# Check available cameras
ffmpeg -f v4l2 -list_formats all -i /dev/video0  # Linux
ffmpeg -list_devices true -f dshow -i dummy      # Windows
```

### Streaming API

```bash
# Start multi-platform stream
POST /api/streaming/start
{
  "platforms": [
    { "id": "bilibili", "enabled": true, "rtmpKey": "xxx" },
    { "id": "youtube", "enabled": true, "rtmpKey": "yyy" }
  ],
  "resolution": "1280x720",
  "bitrate": "2500k"
}

# Get stream status
GET /api/streaming/status

# Stop streaming
POST /api/streaming/stop
```

### Bitrate Recommendations

| Platforms | Resolution | Bitrate | Bandwidth |
|-----------|------------|---------|-----------|
| 1 | 1080p | 2000k | 3 Mbps |
| 2 | 1080p | 2500k | 5 Mbps |
| 3 | 720p | 3000k | 8 Mbps |
| 4 | 720p | 3500k | 10 Mbps |

## Development Notes

- Use TypeScript strict mode
- Follow RESTful API conventions
- All sensor data must include timestamps
- Implement hardware fail-safes (timeout irrigation, max water limits)
- Support multiple cultivation chambers/zones
- Demo mode works without hardware - use for UI development

## API Routes

```
/api/sensor/:deviceId/current   # Get current sensor data
/api/sensor/:deviceId/history   # Get historical data
/api/control/:deviceId/pump      # Control water pump
/api/control/:deviceId/fan       # Control fan
/api/control/devices             # List all devices
/api/streaming/start             # Start multi-platform stream
/api/streaming/stop              # Stop stream
/api/streaming/recordings        # List local recordings
/api/cost/summary                # Cost analysis
/api/notifications/test          # Send test notification
```

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Port 3000 in use (Windows) | Use ports 8080, 9999, or 7777 instead |
| FFmpeg not found | Install FFmpeg and add to PATH |
| MQTT connection fails | Runs in Demo mode - OK for development |
| MySQL connection timeout | Runs in Demo mode - OK for development |
| ESP32 won't connect | Check WiFi credentials and MQTT broker IP |

## Documentation

- [Streaming Guide](./docs/streaming-guide.md) - Multi-platform streaming
- [Hardware Details](./docs/hardware-detailed.md) - Complete hardware list
- [TODO](./docs/TODO.md) - Pending tasks
