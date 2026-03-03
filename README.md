# 🥔 Potato Cultivation System | 土豆智能培育系统

> 基于 ESP32 和 Node.js 的 IoT 土豆培育系统，支持实时监控、自动灌溉和智能告警。

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E=18.0.0-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-5.3.0-blue.svg)](https://www.typescriptlang.org)

---

## ✨ 特性

- 🌱 **实时监测** - 土壤湿度、温度、湿度传感器实时采集
- 💧 **自动灌溉** - 基于土壤湿度阈值自动浇水
- 📹 **视频监控** - ESP32-CAM 实时视频流
- 📊 **数据分析** - 历史数据记录与趋势分析
- 🎛️ **Web控制** - 直观的仪表板和远程控制
- 🔔 **智能告警** - 设备掉线/阈值超标邮件+飞书通知
- 📧 **定期报告** - 每日/每周培育状态自动发送
- 📱 **响应式** - 支持手机、平板、电脑访问
- 🔌 **可扩展** - 支持多个培育箱管理

---

## 🏗️ 技术架构

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
                                   ┌──────┴──────┐
                                   │  Web Dashboard │
                                   │  (Tailwind)   │
                                   └─────────────┘
```

### 技术栈

| 类别 | 技术 |
|------|------|
| 后端 | Node.js + Express + TypeScript |
| 硬件 | ESP32-WROOM-32 + ESP32-CAM |
| 数据库 | MySQL 8.0 (可选，支持 Demo 模式) |
| 通信 | MQTT (Mosquitto) |
| 前端 | Tailwind CSS + Vanilla JS |
| 通知 | Nodemailer + 飞书 Webhook |
| 定时任务 | node-cron |

---

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/din4e/Potato.git
cd Potato
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境

```bash
cp .env.example .env
# 编辑 .env 文件配置参数
```

### 4. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

### 5. 访问控制面板

打开浏览器访问: http://localhost:3000

---

## ⚙️ 配置说明

### 基础配置 (.env)

```bash
# 服务器端口
PORT=3000

# MQTT Broker
MQTT_BROKER=mqtt://localhost:1883

# 告警阈值
SOIL_MOISTURE_MIN=30    # 土壤湿度下限
TEMPERATURE_MAX=35      # 温度上限
```

### 通知配置

```bash
# 启用通知
NOTIFICATIONS_ENABLED=true

# 邮件 (Gmail示例)
EMAIL_ENABLED=true
EMAIL_USER=your@gmail.com
EMAIL_PASS=app_password

# 飞书机器人
FEISHU_WEBHOOK=https://open.feishu.cn/xxx

# 接收人
ALERT_RECIPIENTS=admin@example.com
```

---

## 📦 硬件清单

### 核心组件

| 组件 | 数量 | 价格 |
|------|------|------|
| ESP32 开发板 | 1 | ¥18 |
| ESP32-CAM | 1 | ¥25 |
| 土壤湿度传感器 | 2 | ¥8 |
| DHT22 温湿度 | 1 | ¥5 |
| 5V 继电器 | 2 | ¥6 |
| 微型水泵 | 1 | ¥12 |
| **总计** | | **~¥150** |

详细硬件方案请查看: [docs/hardware-detailed.md](docs/hardware-detailed.md)

---

## 📖 API 文档

### 传感器

```bash
GET /api/sensor/:deviceId/current    # 获取当前数据
GET /api/sensor/:deviceId/history    # 获取历史数据
GET /api/sensor/:deviceId/stats       # 获取统计数据
```

### 控制

```bash
POST /api/control/:deviceId/pump      # 控制水泵
POST /api/control/:deviceId/fan       # 控制风扇
GET  /api/control/:deviceId/status    # 获取设备状态
GET  /api/control/devices             # 获取所有设备
```

### 通知

```bash
GET  /api/notifications/status        # 通知服务状态
POST /api/notifications/test          # 发送测试通知
GET  /api/notifications/health        # 设备健康状态
POST /api/notifications/report/:id    # 手动触发报告
```

---

## 🔧 ESP32 固件

### 烧录步骤

```bash
cd esp32/firmware

# 安装 PlatformIO
pip install platformio

# 配置 WiFi 和 MQTT
# 编辑 src/main.cpp

# 烧录
pio run --target upload

# 监控串口
pio device monitor
```

### 引脚定义

| 功能 | GPIO |
|------|------|
| 土壤湿度 1 | GPIO 34 |
| 土壤湿度 2 | GPIO 35 |
| DHT22 | GPIO 4 |
| 水泵继电器 | GPIO 12 |
| 风扇继电器 | GPIO 14 |

---

## 📋 后续任务

查看 [TODO.md](docs/TODO.md) 了解详细待办事项。

### 快速清单

- [ ] 配置 MQTT Broker
- [ ] 烧录 ESP32 固件
- [ ] 配置邮件通知
- [ ] 组装硬件
- [ ] 连接传感器
- [ ] 测试自动浇水

---

## 🐳 Docker 部署

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

---

## 📂 项目结构

```
potato/
├── src/
│   ├── config/          # 配置文件
│   │   ├── database.ts  # 数据库配置
│   │   └── mqtt.ts      # MQTT配置
│   ├── services/        # 业务逻辑
│   │   ├── healthMonitoringService.ts  # 健康监控
│   │   ├── notificationService.ts      # 通知服务
│   │   └── reportingService.ts         # 报告服务
│   ├── models/          # 数据模型
│   ├── routes/          # API路由
│   ├── controllers/     # 控制器
│   └── index.ts         # 主入口
├── public/              # 前端资源
│   └── index.html       # 单页应用
├── esp32/
│   └── firmware/        # ESP32固件
├── docs/                # 文档
│   ├── TODO.md          # 待办清单
│   └── hardware-detailed.md  # 硬件方案
└── docker-compose.yml   # Docker配置
```

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request!

---

## 📄 许可证

MIT License

---

## 🙏 致谢

- [ESP32](https://www.espressif.com/) - 物联网开发板
- [Express](https://expressjs.com/) - Web 框架
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架
- [ApexCharts](https://apexcharts.com/) - 图表库

---

<div align="center">

**🥔 Happy Potato Growing! 🥔**

Made with ❤️ by din4e

</div>
