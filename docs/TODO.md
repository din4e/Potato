# 后续任务清单

## 🎯 优先级分类

### 🔴 高优先级 (核心功能)

- [ ] **配置并测试MQTT Broker**
  - 安装 Mosquitto MQTT Broker
  - 配置用户认证
  - 测试 ESP32 与服务器通信

- [ ] **烧录 ESP32 固件**
  - 安装 PlatformIO
  - 配置 WiFi 和 MQTT 参数
  - 烧录到 ESP32 开发板
  - 烧录 ESP32-CAM 固件

- [ ] **配置邮件通知服务**
  - 开启 Gmail 两步验证
  - 生成应用专用密码
  - 更新 .env 文件
  - 发送测试邮件验证

- [ ] **配置飞书机器人 (可选)**
  - 创建飞书群
  - 添加自定义机器人
  - 获取 Webhook URL
  - 测试消息推送

### 🟡 中优先级 (增强功能)

- [ ] **MySQL 数据库配置**
  - 安装 MySQL 8.0
  - 创建数据库和用户
  - 配置 .env 连接参数
  - 运行数据库初始化脚本

- [ ] **硬件组装**
  - 购买硬件组件 (参考 docs/hardware-detailed.md)
  - 连接传感器到 ESP32
  - 连接继电器和水泵
  - 安装培育箱体

- [ ] **摄像头流配置**
  - 配置 ESP32-CAM
  - 获取视频流地址
  - 集成到前端显示

- [ ] **定时任务配置**
  - 设置浇水时间表
  - 配置每日/每周报告时间
  - 测试自动浇水功能

### 🟢 低优先级 (优化功能)

- [ ] **前端优化**
  - 添加更多图表类型
  - 历史数据查询功能
  - 移动端 PWA 支持

- [ ] **多设备管理**
  - 添加更多培育箱
  - 设备分组管理
  - 批量控制功能

- [ ] **数据分析**
  - 生长趋势分析
  - 浇水效果统计
  - 异常检测算法

- [ ] **移动端 APP**
  - React Native 开发
  - 推送通知集成
  - 离线数据缓存

---

## 📝 详细操作步骤

### 1. MQTT Broker 安装

#### Windows
```bash
# 下载 Mosquitto
# https://mosquitto.org/download/

# 安装后配置文件位置
C:\Program Files\mosquitto\mosquitto.conf

# 添加以下配置
listener 1883
allow_anonymous true
```

#### Docker (推荐)
```bash
docker run -d -p 1883:1883 \
  -v mosquitto_data:/mosquitto/data \
  -v mosquitto_logs:/mosquitto/log \
  eclipse-mosquitto
```

#### 测试 MQTT
```bash
# 订阅测试
mosquitto_sub -h localhost -t "potato/#" -v

# ESP32 配置
MQTT_BROKER=mqtt://your-server-ip:1883
```

---

### 2. ESP32 固件烧录

#### 安装 PlatformIO
```bash
pip install platformio

# 或使用 VS Code 扩展
code --install-extension platformio.platformio-ide
```

#### 配置固件
```bash
cd esp32/firmware/src

# 编辑 main.cpp
const char* WIFI_SSID = "YourWiFi";
const char* WIFI_PASSWORD = "YourPassword";
const char* MQTT_SERVER = "192.168.1.100"; # 服务器IP
```

#### 烧录
```bash
cd esp32/firmware
pio run --target upload

# 查看串口输出
pio device monitor
```

---

### 3. Gmail 邮件配置

#### 获取应用专用密码
1. 访问 https://myaccount.google.com/security
2. 开启两步验证
3. 生成应用专用密码
4. 复制密码到 `.env`

#### .env 配置
```bash
EMAIL_ENABLED=true
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password_here
ALERT_RECIPIENTS=your_email@gmail.com
```

#### 测试邮件
```bash
curl -X POST http://localhost:3000/api/notifications/test
```

---

### 4. 飞书机器人配置

#### 创建机器人
1. 打开飞书群
2. 群设置 → 机器人 → 添加机器人 → 自定义
3. 输入名称，点击添加
4. 复制 Webhook URL

#### .env 配置
```bash
FEISHU_WEBHOOK=https://open.feishu.cn/open-apis/bot/v2/hook/xxx
```

#### 测试飞书
```bash
# 测试消息
curl -X POST $FEISHU_WEBHOOK \
  -H "Content-Type: application/json" \
  -d '{"msg_type":"text","content":{"text":"测试消息"}}'
```

---

### 5. MySQL 配置 (可选)

#### Windows 安装
```bash
# 下载 MySQL 8.0
# https://dev.mysql.com/downloads/mysql/

# 或使用 Docker
docker run -d -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=root123 \
  -e MYSQL_DATABASE=potato_system \
  mysql:8.0
```

#### 创建数据库
```sql
CREATE DATABASE potato_system;
CREATE USER 'potato'@'localhost' IDENTIFIED BY 'potato123';
GRANT ALL PRIVILEGES ON potato_system.* TO 'potato'@'localhost';
FLUSH PRIVILEGES;
```

#### .env 配置
```bash
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=potato
MYSQL_PASSWORD=potato123
MYSQL_DB=potato_system
```

---

### 6. 硬件组装清单

#### 必需工具
- [ ] 电烙铁
- [ ] 杜邦线 (公对母)
- [ ] 面包板 (用于测试)
- [ ] 万用表
- [ ] USB 数据线

#### 接线步骤
1. ESP32 开发板 → 面包板
2. 土壤传感器 → GPIO34/GPIO35
3. DHT22 → GPIO4
4. 继电器 IN1 → GPIO12 (水泵)
5. 继电器 IN2 → GPIO14 (风扇)
6. 水泵 → 继电器 NO/COM 触点
7. 5V 电源 → ESP32 VIN + 继电器 VCC

#### 测试流程
```
1. 上传测试代码
2. 打开串口监视器
3. 检查传感器读数
4. 测试继电器开关
5. 测试水泵工作
```

---

## 🧪 测试检查清单

### 功能测试

- [ ] **传感器读取**
  - [ ] 土壤湿度1正常显示
  - [ ] 土壤湿度2正常显示
  - [ ] 温度正常显示
  - [ ] 湿度正常显示

- [ ] **控制功能**
  - [ ] 水泵开启/关闭正常
  - [ ] 风扇开启/关闭正常
  - [ ] 手动浇水功能正常

- [ ] **自动化功能**
  - [ ] 土壤过低自动浇水
  - [ ] 温度过高自动开风扇
  - [ ] 定时浇水正常执行

- [ ] **通知功能**
  - [ ] 测试邮件发送成功
  - [ ] 测试飞书消息发送成功
  - [ ] 测试掉线告警（断开ESP32测试）

- [ ] **报告功能**
  - [ ] 手动触发日报
  - [ ] 手动触发周报
  - [ ] 报告内容完整

### 性能测试

- [ ] 服务器稳定运行24小时
- [ ] ESP32 长时间运行不重启
- [ ] MQTT 连接稳定
- [ ] 内存使用正常
- [ ] 数据库查询响应快速

---

## 📚 文档更新记录

| 日期 | 文档 | 更新内容 |
|------|------|----------|
| 2024-03-03 | README.md | 项目初始化 |
| 2024-03-03 | docs/hardware-detailed.md | 详细硬件方案 |
| 2024-03-03 | TODO.md | 本任务清单创建 |

---

## 🐛 已知问题

| 问题 | 状态 | 解决方案 |
|------|------|----------|
| MySQL 连接超时 | 已解决 | 添加超时配置，Demo模式降级 |
| MQTT 无响应 | 已知 | 需配置本地Broker |
| ESP32 热重启 | 待解决 | 检查电源供应 |
| 邮件发送失败 | 待验证 | 配置SMTP参数 |

---

## 📞 获取帮助

- GitHub Issues: https://github.com/din4e/Potato/issues
- 文档: https://github.com/din4e/Potato/blob/master/README.md

---

*最后更新: 2024-03-03*
