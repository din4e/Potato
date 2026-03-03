# 土豆培育系统 - 实验版快速指南

> 🧪 最简实验方案 - 预算约¥80，1小时完成

---

## 📦 极简硬件清单（¥80）

| 组件 | 价格 | 说明 |
|------|------|------|
| ESP32开发板 | ¥20 | 淘宝搜"ESP32" |
| 土壤湿度传感器(电容式) | ¥4 | 必需电容式，防腐蚀 |
| DHT22温湿度 | ¥5 | 可用DHT11替代(¥2) |
| 5V 1路继电器 | ¥3 | 控制水泵 |
| 5V微型潜水泵 | ¥12 | 淘宝搜"5V潜水泵" |
| 杜邦线 | ¥5 | 公对母40Pin |
| 储物箱 | ¥15 | 20-30L透明箱，或用旧盒 |
| 种植盆x2 | ¥6 | 12cm带底盘 |
| 营养土 | ¥10 | 5L小袋 |
| **总计** | **¥80** | |

---

## 🌱 种薯准备

**需要：1个土豆**

```
步骤：
1. 选1个发芽的健康土豆
2. 切成2块（每块带1-2个芽眼）
3. 切口蘸草木灰或晾干1天
4. 形成愈合层，防止腐烂
```

---

## 🔌 3步接线

```
┌─────────────────────────────────────┐
│            ESP32                     │
│  ┌───────┐ ┌───────┐ ┌───────┐     │
│  │ GPIO34│ │ GPIO4 │ │ GPIO12│     │
│  └───┬───┘ └───┬───┘ └───┬───┘     │
│      │        │        │           │
│      ▼        ▼        ▼           │
│  ┌──────────────────────────────┐  │
│  │ 土壤传感 │ DHT22  │ 继电器   │  │
│  │   VCC→3V3  VCC→3V3  VCC→5V   │  │
│  │   GND→GND  GND→GND  GND→GND  │  │
│  │   SIG→34   DAT→4   IN→12    │  │
│  └──────────────────────────────┘  │
│                                     │
│  继电器输出：                        │
│    COM → 5V (USB)                   │
│    NO  → 水泵+                      │
│    水泵- → GND                      │
└─────────────────────────────────────┘
```

---

## 🧪 ESP32 固件代码（简化版）

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>

// ============ 配置区 ============
const char* WIFI_SSID = "你的WiFi名称";
const char* WIFI_PASSWORD = "你的WiFi密码";
const char* MQTT_SERVER = "192.168.1.100"; // 电脑IP地址

// 引脚定义
const int SOIL_SENSOR = 34;  // 土壤湿度
const int DHT_PIN = 4;       // 温湿度
const int PUMP_RELAY = 12;   // 水泵继电器

// 阈值
const int SOIL_DRY_THRESHOLD = 40;  // 低于40%浇水
const int PUMP_TIME_MS = 5000;      // 浇水5秒

// ============ 全局变量 ============
WiFiClient espClient;
PubSubClient mqtt(espClient);
DHT dht(DHT_PIN, DHT22);

unsigned long lastCheck = 0;
const long CHECK_INTERVAL = 60000; // 每分钟检查一次

// ============ WiFi连接 ============
void setupWiFi() {
  Serial.print("连接WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi已连接!");
  Serial.print("IP地址: ");
  Serial.println(WiFi.localIP());
}

// ============ MQTT回调 ============
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print("收到消息 [");
  Serial.print(topic);
  Serial.print("]: ");

  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println(message);

  // 处理控制命令
  if (message == "pump_on") {
    digitalWrite(PUMP_RELAY, LOW);  // 低电平触发
    Serial.println("水泵开启");
  } else if (message == "pump_off") {
    digitalWrite(PUMP_RELAY, HIGH);
    Serial.println("水泵关闭");
  }
}

// ============ MQTT重连 ============
void reconnectMQTT() {
  while (!mqtt.connected()) {
    Serial.print("连接MQTT...");
    String clientId = "esp32-potato-" + String(random(0xffff), HEX);

    if (mqtt.connect(clientId.c_str())) {
      Serial.println("已连接!");
      mqtt.subscribe("potato/control/#");
    } else {
      Serial.print("失败, rc=");
      Serial.print(mqtt.state());
      delay(5000);
    }
  }
}

// ============ 读取传感器 ============
void readSensors() {
  // 土壤湿度（电容式：值越小越湿）
  int soilRaw = analogRead(SOIL_SENSOR);
  int soilPercent = map(soilRaw, 2800, 1200, 0, 100);
  soilPercent = constrain(soilPercent, 0, 100);

  // 温湿度
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();

  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("DHT22读取失败!");
    return;
  }

  // 打印到串口
  Serial.println("=== 传感器数据 ===");
  Serial.print("土壤湿度: ");
  Serial.print(soilPercent);
  Serial.println("%");
  Serial.print("空气温度: ");
  Serial.print(temperature);
  Serial.println("°C");
  Serial.print("空气湿度: ");
  Serial.print(humidity);
  Serial.println("%");

  // 发送到MQTT
  String payload = "{\"soil\":" + String(soilPercent) +
                    ",\"temp\":" + String(temperature) +
                    ",\"hum\":" + String(humidity) + "}";
  mqtt.publish("potato/sensors", payload.c_str());

  // 自动浇水判断
  if (soilPercent < SOIL_DRY_THRESHOLD) {
    Serial.println("土壤过干，开始浇水...");
    digitalWrite(PUMP_RELAY, LOW);
    delay(PUMP_TIME_MS);
    digitalWrite(PUMP_RELAY, HIGH);
    Serial.println("浇水完成");
  }
}

// ============ 初始化 ============
void setup() {
  Serial.begin(115200);

  // 引脚初始化
  pinMode(PUMP_RELAY, OUTPUT);
  digitalWrite(PUMP_RELAY, HIGH);  // 初始关闭

  // 传感器初始化
  dht.begin();

  // 连接WiFi和MQTT
  setupWiFi();
  mqtt.setServer(MQTT_SERVER, 1883);
  mqtt.setCallback(mqttCallback);

  Serial.println("系统启动完成!");
}

// ============ 主循环 ============
void loop() {
  if (!mqtt.connected()) {
    reconnectMQTT();
  }
  mqtt.loop();

  // 定时检查传感器
  unsigned long now = millis();
  if (now - lastCheck >= CHECK_INTERVAL) {
    lastCheck = now;
    readSensors();
  }

  delay(100);
}
```

---

## 🚀 启动步骤

### 1. 启动服务（首次）
```bash
# 启动 MQTT + MySQL + Adminer
docker compose up -d

# 查看服务状态
docker compose ps
```

服务地址：
- MQTT: `localhost:1883`
- MySQL: `localhost:3306`
- Adminer: `http://localhost:8080` (数据库管理界面)

### 2. 启动后端
```bash
npm run dev
```

### 3. 烧录ESP32
1. Arduino IDE 上传上面的代码
2. 修改 WiFi 和 MQTT_SERVER 配置
3. 上传后打开串口监视器

### 4. 访问控制面板
```
浏览器打开: http://localhost:3002
```

---

## 📅 实验时间表

| 天数 | 操作 | 预期结果 |
|------|------|----------|
| Day 1 | 切块晾干土豆种薯 | 形成愈合层 |
| Day 2 | 装土播种，启动系统 | 系统开始监测 |
| Day 3-7 | 观察传感器数据 | 数值正常变化 |
| Day 7-14 | 等待发芽 | 土表开裂，嫩芽出土 |
| Day 14-30 | 植株生长 | 叶片展开 |
| Day 60-90 | 收获 | 约0.5-1斤新土豆 |

---

## ✅ 实验检查清单

### 硬件测试
- [ ] ESP32连接WiFi成功
- [ ] 串口显示传感器数值
- [ ] MQTT连接成功
- [ ] 继电器有"咔嗒"声
- [ ] 水泵能正常抽水

### 软件测试
- [ ] Web面板显示数据
- [ ] 手动浇水按钮有效
- [ ] 数据正常保存到数据库

### 种植测试
- [ ] 土壤湿度低于阈值自动浇水
- [ ] 土豆发芽（约7-14天）
- [ ] 植株正常生长

---

## 🎯 实验成功标准

1. ✅ 系统能自动监测土壤湿度
2. ✅ 低于阈值自动浇水
3. ✅ 能远程查看数据
4. ✅ 土豆发芽生长
5. ✅ 收获少量新土豆

**实验允许失败，重点是学习和验证！** 🧪
