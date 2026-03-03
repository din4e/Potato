/*
 * 土豆培育系统 - ESP32 固件
 * 实验版 - 简化配置
 *
 * 功能：
 * - WiFi 连接
 * - MQTT 通信
 * - 土壤湿度监测
 * - 温湿度监测 (DHT22)
 * - 自动浇水控制
 * - 远程手动控制
 *
 * 硬件连接：
 * - GPIO34 → 土壤湿度传感器
 * - GPIO4  → DHT22 温湿度传感器
 * - GPIO12 → 继电器（水泵）
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>

// ==================== 配置区 ====================

// WiFi 配置
const char* WIFI_SSID = "你的WiFi名称";      // 修改为你的WiFi名称
const char* WIFI_PASSWORD = "你的WiFi密码";  // 修改为你的WiFi密码

// MQTT 配置
const char* MQTT_SERVER = "192.168.1.100";  // 修改为电脑IP地址
const int MQTT_PORT = 9000;                  // Docker 映射的端口
const char* MQTT_CLIENT_ID = "esp32-potato-01";

// 主题定义
const char* TOPIC_SENSORS = "potato/sensors";
const char* TOPIC_CONTROL = "potato/control/#";
const char* TOPIC_STATUS = "potato/status";

// 引脚定义
const int PIN_SOIL_SENSOR = 34;   // 土壤湿度传感器 (ADC1_CH6)
const int PIN_DHT = 4;           // DHT22 温湿度传感器
const int PIN_PUMP_RELAY = 12;   // 水泵继电器

// 传感器阈值
const int SOIL_DRY_THRESHOLD = 30;    // 土壤湿度下限 (%)
const int SOIL_WET_THRESHOLD = 70;    // 土壤湿度上限 (%)
const unsigned long PUMP_DURATION = 5000;  // 浇水持续时间 (ms)
const unsigned long SENSOR_INTERVAL = 30000;  // 传感器读取间隔 (ms)

// DHT22 配置
#define DHTTYPE DHT22

// ==================== 全局变量 ====================

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
DHT dht(PIN_DHT, DHTTYPE);

unsigned long lastSensorRead = 0;
unsigned long lastPumpOn = 0;
bool pumpManualOverride = false;

// 传感器数据
struct SensorData {
  int soilMoisture;      // 土壤湿度 %
  float temperature;     // 空气温度 °C
  float humidity;        // 空气湿度 %
  bool pumpActive;       // 水泵状态
  unsigned long uptime;  // 运行时间秒
};

SensorData currentData = {0, 0, 0, false, 0};

// ==================== WiFi 连接 ====================

void setupWiFi() {
  Serial.println();
  Serial.println("========================================");
  Serial.println("🥔 土豆培育系统 - ESP32 固件");
  Serial.println("========================================");
  Serial.print("连接WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi已连接!");
    Serial.print("IP地址: ");
    Serial.println(WiFi.localIP());
    Serial.print("信号强度: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    Serial.println("\n❌ WiFi连接失败!");
    Serial.println("将使用离线模式...");
  }
}

// ==================== MQTT 回调 ====================

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print("\n📨 收到消息 [");
  Serial.print(topic);
  Serial.print("]: ");

  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println(message);

  // 解析控制命令
  if (strcmp(topic, "potato/control/pump") == 0) {
    if (message == "on") {
      pumpOn(true);  // 手动开启
    } else if (message == "off") {
      pumpOff(true); // 手动关闭
    }
  }
  else if (strcmp(topic, "potato/control/auto") == 0) {
    if (message == "enable") {
      pumpManualOverride = false;
      Serial.println("🔄 自动浇水已启用");
    } else if (message == "disable") {
      pumpManualOverride = true;
      Serial.println("⏸️ 自动浇水已禁用");
    }
  }
}

// ==================== MQTT 连接 ====================

void reconnectMQTT() {
  static unsigned long lastAttempt = 0;
  unsigned long now = millis();

  // 每5秒尝试一次
  if (now - lastAttempt < 5000) return;
  lastAttempt = now;

  if (!mqttClient.connected()) {
    Serial.print("🔌 连接MQTT... ");

    // 生成随机客户端ID
    String clientId = "esp32-potato-";
    clientId += String(random(0xffff), HEX);

    if (mqttClient.connect(clientId.c_str())) {
      Serial.println("✅ 已连接!");

      // 订阅控制主题
      mqttClient.subscribe("potato/control/pump");
      mqttClient.subscribe("potato/control/auto");

      // 发送上线消息
      publishStatus("online");
    } else {
      Serial.print("❌ 失败 (rc=");
      Serial.print(mqttClient.state());
      Serial.println(")");
    }
  }
}

// ==================== 发布消息 ====================

void publishSensors() {
  // 构建 JSON 消息
  String payload = "{";
  payload += "\"soil\":" + String(currentData.soilMoisture) + ",";
  payload += "\"temp\":" + String(currentData.temperature, 1) + ",";
  payload += "\"hum\":" + String(currentData.humidity, 1) + ",";
  payload += "\"pump\":" + String(currentData.pumpActive ? "true" : "false") + ",";
  payload += "\"uptime\":" + String(currentData.uptime);
  payload += "}";

  if (mqttClient.publish(TOPIC_SENSORS, payload.c_str())) {
    Serial.println("📤 传感器数据已发送");
  }
}

void publishStatus(const char* status) {
  String payload = "{\"status\":\"" + String(status) + "\"";
  payload += ",\"ip\":\"" + WiFi.localIP().toString() + "\"";
  payload += ",\"rssi\":" + String(WiFi.RSSI());
  payload += "}";

  mqttClient.publish(TOPIC_STATUS, payload.c_str());
}

// ==================== 传感器读取 ====================

void readSensors() {
  Serial.println("\n=== 📊 读取传感器 ===");

  // 1. 土壤湿度
  int soilRaw = analogRead(PIN_SOIL_SENSOR);
  // 电容式传感器映射：2800(干) → 1200(湿)
  // 转换为百分比：0% = 干, 100% = 湿
  currentData.soilMoisture = map(soilRaw, 2800, 1200, 0, 100);
  currentData.soilMoisture = constrain(currentData.soilMoisture, 0, 100);

  Serial.print("🌱 土壤湿度: ");
  Serial.print(currentData.soilMoisture);
  Serial.println("%");
  Serial.print("   原始值: ");
  Serial.println(soilRaw);

  // 2. 温湿度
  currentData.temperature = dht.readTemperature();
  currentData.humidity = dht.readHumidity();

  if (isnan(currentData.temperature) || isnan(currentData.humidity)) {
    Serial.println("⚠️ DHT22读取失败!");
    currentData.temperature = 0;
    currentData.humidity = 0;
  } else {
    Serial.print("🌡️ 温度: ");
    Serial.print(currentData.temperature, 1);
    Serial.println("°C");
    Serial.print("💧 湿度: ");
    Serial.print(currentData.humidity, 1);
    Serial.println("%");
  }

  // 3. 运行时间
  currentData.uptime = millis() / 1000;

  // 4. 自动浇水判断
  checkAndWater();

  // 5. 发送数据到 MQTT
  if (mqttClient.connected()) {
    publishSensors();
  }
}

// ==================== 水泵控制 ====================

void pumpOn(bool manual = false) {
  digitalWrite(PIN_PUMP_RELAY, LOW);  // 低电平触发
  currentData.pumpActive = true;
  lastPumpOn = millis();

  if (manual) {
    pumpManualOverride = true;
    Serial.println("🚿 手动开启水泵");
  } else {
    Serial.println("🚿 自动开启水泵");
  }

  // 发送状态
  if (mqttClient.connected()) {
    mqttClient.publish("potato/pump", "ON");
  }
}

void pumpOff(bool manual = false) {
  digitalWrite(PIN_PUMP_RELAY, HIGH);  // 高电平关闭
  currentData.pumpActive = false;

  if (manual) {
    Serial.println("🚿 手动关闭水泵");
  }

  // 发送状态
  if (mqttClient.connected()) {
    mqttClient.publish("potato/pump", "OFF");
  }
}

void checkAndWater() {
  // 如果手动覆盖，不执行自动浇水
  if (pumpManualOverride) {
    return;
  }

  // 检查是否需要浇水
  if (currentData.soilMoisture < SOIL_DRY_THRESHOLD && !currentData.pumpActive) {
    Serial.println("⚠️ 土壤过干，开始浇水...");

    // 计算浇水时长：越干旱浇越久
    int waterTime = map(currentData.soilMoisture, 0, SOIL_DRY_THRESHOLD, 10000, 3000);
    waterTime = constrain(waterTime, 3000, 15000);

    Serial.print("⏱️ 浇水时长: ");
    Serial.print(waterTime / 1000);
    Serial.println("秒");

    pumpOn();
    delay(waterTime);
    pumpOff();
  }

  // 检查是否过湿
  if (currentData.soilMoisture > SOIL_WET_THRESHOLD) {
    Serial.println("💧 土壤湿度过高，暂停浇水");
  }
}

// ==================== 设置 ====================

void setup() {
  // 串口初始化
  Serial.begin(115200);
  delay(1000);

  // 引脚初始化
  pinMode(PIN_SOIL_SENSOR, INPUT);
  pinMode(PIN_PUMP_RELAY, OUTPUT);
  digitalWrite(PIN_PUMP_RELAY, HIGH);  // 初始关闭

  // DHT22 初始化
  dht.begin();

  // WiFi 连接
  setupWiFi();

  // MQTT 配置
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);

  Serial.println("\n========================================");
  Serial.println("🥔 系统初始化完成!");
  Serial.println("========================================");
  Serial.println("📡 MQTT服务器: " + String(MQTT_SERVER));
  Serial.println("🔌 MQTT端口: " + String(MQTT_PORT));
  Serial.println("🚿 浇水阈值: < " + String(SOIL_DRY_THRESHOLD) + "%");
  Serial.println("========================================\n");
}

// ==================== 主循环 ====================

void loop() {
  // MQTT 连接检查
  if (WiFi.status() == WL_CONNECTED) {
    if (!mqttClient.connected()) {
      reconnectMQTT();
    }
    mqttClient.loop();
  }

  // 定时读取传感器
  unsigned long now = millis();
  if (now - lastSensorRead >= SENSOR_INTERVAL) {
    lastSensorRead = now;
    readSensors();
  }

  // 水泵超时保护（最长运行15秒）
  if (currentData.pumpActive && (now - lastPumpOn > 15000)) {
    Serial.println("⏰ 水泵超时，强制关闭!");
    pumpOff();
  }

  delay(100);
}
