# 🥔 Potato Cultivation System | 土豆培育系统

A smart IoT-based potato cultivation system with real-time monitoring, automatic irrigation, and web-based control interface.

一套基于物联网的智能土豆培育系统，支持实时监控、自动灌溉和Web控制界面。

## Features | 功能特性

- 🌱 **实时环境监测** - 土壤湿度、温度、湿度传感器数据实时采集
- 💧 **自动灌溉控制** - 基于土壤湿度阈值自动浇水
- 📹 **视频直播监控** - ESP32-CAM 实时视频流
- 📊 **数据记录分析** - MySQL 存储历史数据，支持趋势分析
- 🎛️ **Web控制界面** - 直观的仪表板和远程控制
- 📱 **响应式设计** - 支持手机、平板、电脑访问
- 🔔 **智能告警** - 异常情况自动通知
- 🔌 **可扩展架构** - 支持多个培育箱管理

## Hardware Requirements | 硬件需求

| 组件 | 推荐型号 | 数量 |
|------|----------|------|
| 主控板 | ESP32-WROOM-32 | 1 |
| 摄像头 | ESP32-CAM (可选) | 1 |
| 土壤湿度传感器 | 电容式 | 2 |
| 温湿度传感器 | DHT22 | 1 |
| 继电器模块 | 5V 1路 | 2 |
| 水泵 | 5V 微型潜水泵 | 1 |
| 电源适配器 | 5V 2A | 1 |

**总成本**: 约 ¥145 (详细清单见 [docs/hardware-setup.md](docs/hardware-setup.md))

## Software Requirements | 软件需求

- Node.js >= 18.x
- MySQL >= 8.0
- MQTT Broker (Mosquitto)
- PlatformIO (用于ESP32固件开发)

## Quick Start | 快速开始

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/potato.git
cd potato
```

### 2. Backend Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
nano .env

# Initialize database
npm run migrate

# Start development server
npm run dev
```

### 3. ESP32 Firmware

```bash
cd esp32/firmware

# Install PlatformIO (if not installed)
pip install platformio

# Upload firmware
pio run --target upload

# Monitor serial output
pio device monitor
```

### 4. Access Dashboard

Open browser: `http://localhost:3000`

## Project Structure | 项目结构

```
potato/
├── src/
│   ├── controllers/    # API 路由处理器
│   ├── services/       # 业务逻辑
│   ├── models/         # 数据库模型
│   ├── routes/         # Express 路由
│   ├── middleware/     # 中间件
│   ├── config/         # 配置文件
│   └── types/          # TypeScript 类型
├── public/             # 前端静态资源
├── esp32/
│   └── firmware/       # ESP32 固件
├── docs/               # 文档
└── CLAUDE.md          # Claude Code 指引
```

## API Endpoints | API 接口

### Sensors
- `GET /api/sensors/current` - 获取当前传感器数据
- `GET /api/sensors/history` - 获取历史数据
- `GET /api/sensors/stats` - 获取统计数据

### Controls
- `POST /api/control/pump` - 控制水泵
- `POST /api/control/fan` - 控制风扇
- `GET /api/control/status` - 获取设备状态

### Irrigation
- `GET /api/irrigation/logs` - 浇水日志
- `POST /api/irrigation/schedule` - 设置定时浇水
- `DELETE /api/irrigation/schedule/:id` - 删除定时任务

## ESP32 Pin Configuration | 引脚配置

| 功能 | GPIO 引脚 |
|------|-----------|
| 土壤湿度传感器 1 | GPIO 34 |
| 土壤湿度传感器 2 | GPIO 35 |
| DHT22 数据 | GPIO 4 |
| 水泵继电器 | GPIO 12 |
| 风扇继电器 | GPIO 14 |
| 状态 LED | GPIO 2 |

## Development | 开发

```bash
# Run tests
npm test

# Lint code
npm run lint

# Build for production
npm run build

# Start production server
npm start
```

## Roadmap | 开发计划

- [x] 基础传感器读取
- [x] MQTT 通信
- [x] 自动灌溉逻辑
- [ ] 视频直播集成
- [ ] 多设备管理
- [ ] 数据分析图表
- [ ] 移动端 APP
- [ ] 机器学习病虫害检测

## Contributing | 贡献

欢迎提交 Issue 和 Pull Request!

## License | 许可证

MIT License
