# 快速开始指南

## 📦 一键启动 (Docker)

```bash
# 克隆项目
git clone https://github.com/din4e/Potato.git
cd Potato

# 启动所有服务 (MQTT + MySQL + Adminer)
docker-compose up -d

# 等待服务启动
sleep 10

# 安装后端依赖
npm install

# 配置环境变量
cat > .env << EOF
PORT=3000
MQTT_BROKER=mqtt://localhost
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=potato
MYSQL_PASSWORD=potato
MYSQL_DB=potato_system
EOF

# 启动后端
npm run dev

# 访问控制面板
# http://localhost:3000
```

---

## 🔧 手动安装

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件
```

### 3. 启动开发服务器

```bash
npm run dev
```

---

## 📱 ESP32 烧录

### 安装 PlatformIO

```bash
pip install platformio
# 或在 VS Code 中安装 PlatformIO 扩展
```

### 配置固件

编辑 `esp32/firmware/src/main.cpp`:

```cpp
const char* WIFI_SSID = "YourWiFi";
const char* WIFI_PASSWORD = "YourPassword";
const char* MQTT_SERVER = "192.168.1.100"; // 电脑IP
```

### 烧录

```bash
cd esp32/firmware
pio run --target upload
pio device monitor
```

---

## 📧 配置邮件通知

### Gmail 配置

1. 开启两步验证: https://myaccount.google.com/security
2. 生成应用专用密码
3. 更新 `.env`:

```bash
EMAIL_ENABLED=true
EMAIL_USER=your@gmail.com
EMAIL_PASS=your_app_password
ALERT_RECIPIENTS=your@gmail.com
```

### 测试邮件

```bash
curl -X POST http://localhost:3000/api/notifications/test
```

---

## 🤖 配置飞书通知

### 创建机器人

1. 打开飞书群 → 群设置 → 机器人 → 添加机器人
2. 自定义机器人 → 复制 Webhook URL
3. 更新 `.env`:

```bash
FEISHU_WEBHOOK=https://open.feishu.cn/open-apis/bot/v2/hook/xxx
```

### 测试飞书

```bash
curl -X POST $FEISHU_WEBHOOK \
  -H "Content-Type: application/json" \
  -d '{"msg_type":"text","content":{"text":"测试消息"}}'
```

---

## 🧪 功能测试

### 测试传感器读取

```bash
curl http://localhost:3000/api/sensor/potato-chamber-01/current
```

### 测试设备控制

```bash
# 开启水泵
curl -X POST http://localhost:3000/api/control/potato-chamber-01/pump \
  -H "Content-Type: application/json" \
  -d '{"action":"on"}'
```

### 手动触发报告

```bash
curl -X POST http://localhost:3000/api/notifications/report/potato-chamber-01 \
  -H "Content-Type: application/json" \
  -d '{"period":"daily"}'
```

---

## 📊 默认配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| 服务器端口 | 3000 | Web服务端口 |
| MQTT Broker | localhost:1883 | 消息队列 |
| 掉线阈值 | 5分钟 | 设备无响应告警 |
| 日报时间 | 8:00 | 每日报告发送时间 |
| 周报时间 | 周日 9:00 | 每周报告发送时间 |

---

## 🆘 常见问题

### Q: MySQL 连接失败？
A: 使用 Demo 模式，无需 MySQL 也能运行基本功能

### Q: ESP32 连不上 MQTT？
A: 检查电脑防火墙，确保 1883 端口开放

### Q: 邮件发送失败？
A: Gmail 需要使用应用专用密码，不能使用账号密码

### Q: 飞书收不到消息？
A: 检查 Webhook URL 是否正确，机器人是否还在群里

---

## 📞 获取帮助

- GitHub Issues: https://github.com/din4e/Potato/issues
- 完整文档: [README.md](../README.md)
- 待办清单: [TODO.md](TODO.md)
