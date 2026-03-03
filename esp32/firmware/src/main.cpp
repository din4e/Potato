#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <esp_camera.h>

// ============================================================
// 配置区域 - 请根据实际修改
// ============================================================

// WiFi 配置
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// MQTT 配置
const char* MQTT_SERVER = "192.168.1.100";  // Node.js 后端 IP
const int MQTT_PORT = 1883;
const char* MQTT_CLIENT_ID = "potato-chamber-01";
const char* MQTT_USER = "";
const char* MQTT_PASSWORD = "";

// 引脚定义
#define SOIL_MOISTURE_PIN_1    34  // ADC1_CH6
#define SOIL_MOISTURE_PIN_2    35  // ADC1_CH7
#define DHT_PIN                4   // DHT22 数据引脚
#define PUMP_RELAY_PIN         12  // 水泵继电器控制
#define FAN_RELAY_PIN          14  // 风扇继电器控制
#define LED_PIN                2   // 状态指示灯

// 传感器阈值
#define SOIL_MOISTURE_THRESHOLD 30  // 土壤湿度低于此值触发浇水
#define TEMPERATURE_THRESHOLD      35  // 温度高于此值触发风扇
#define HUMIDITY_THRESHOLD_MIN     40  // 湿度下限
#define HUMIDITY_THRESHOLD_MAX     80  // 湿度上限

// MQTT 主题
const char* MQTT_TOPIC_SENSOR = "potato/sensor";
const char* MQTT_TOPIC_CONTROL = "potato/control";
const char* MQTT_TOPIC_STATUS = "potato/status";

// ============================================================
// 全局变量
// ============================================================

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
DHT dht(DHT_PIN, DHT22);

// 传感器数据结构
struct SensorData {
  float soilMoisture1;
  float soilMoisture2;
  float temperature;
  float humidity;
  unsigned long timestamp;
};

SensorData sensorData;
unsigned long lastSensorRead = 0;
const unsigned long SENSOR_READ_INTERVAL = 5000;  // 5秒读取一次

// ============================================================
// 摄像头配置 (ESP32-CAM AI-Thinker 版本)
// ============================================================

#define CAMERA_MODEL_ESP32CAM

#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27

#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// ============================================================
// 函数声明
// ============================================================

void setupWiFi();
void setupMQTT();
void setupCamera();
void setupPins();
void readSensors();
void publishSensorData();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void handleControl(const char* device, const char* action);
void reconnectMQTT();
void blinkLED(int times, int delayMs);

// ============================================================
// Arduino 标准函数
// ============================================================

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n========================================");
  Serial.println("土豆培育系统 - ESP32 控制器");
  Serial.println("Potato Cultivation System v1.0");
  Serial.println("========================================\n");

  setupPins();
  setupWiFi();
  setupMQTT();

  // 初始化 DHT 传感器
  dht.begin();

  // 初始化摄像头 (可选)
  // setupCamera();

  Serial.println("系统初始化完成!\n");
  blinkLED(3, 100);
}

void loop() {
  // 确保 MQTT 连接
  if (!mqttClient.connected()) {
    reconnectMQTT();
  }
  mqttClient.loop();

  // 定时读取传感器数据
  unsigned long currentMillis = millis();
  if (currentMillis - lastSensorRead >= SENSOR_READ_INTERVAL) {
    lastSensorRead = currentMillis;
    readSensors();
    publishSensorData();

    // 自动控制逻辑
    autoControl();
  }

  delay(100);
}

// ============================================================
// WiFi 连接
// ============================================================

void setupWiFi() {
  Serial.print("连接 WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi 连接成功!");
    Serial.print("IP 地址: ");
    Serial.println(WiFi.localIP());
    Serial.print("信号强度: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    Serial.println("\nWiFi 连接失败，将尝试重连...");
  }
}

// ============================================================
// MQTT 设置
// ============================================================

void setupMQTT() {
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  Serial.println("MQTT 客户端配置完成");
}

void reconnectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("连接 MQTT 服务器...");

    if (mqttClient.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASSWORD,
                          MQTT_TOPIC_STATUS, 1, true, "offline")) {
      Serial.println("成功!");

      // 发布在线状态
      mqttClient.publish(MQTT_TOPIC_STATUS, "online", true);

      // 订阅控制主题
      mqttClient.subscribe(MQTT_TOPIC_CONTROL);
      Serial.println("已订阅控制主题");

      blinkLED(2, 50);
    } else {
      Serial.print("失败, 错误代码: ");
      Serial.print(mqttClient.state());
      Serial.println("，5秒后重试...");
      delay(5000);
    }
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print("收到消息 [");
  Serial.print(topic);
  Serial.print("]: ");

  // 解析 JSON 消息
  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, payload, length);

  if (error) {
    Serial.println("JSON 解析失败!");
    return;
  }

  // 获取设备和操作类型
  const char* device = doc["device"];
  const char* action = doc["action"];
  const char* value = doc["value"];

  Serial.print("设备: ");
  Serial.print(device);
  Serial.print(", 操作: ");
  Serial.println(action);

  handleControl(device, action);
}

// ============================================================
// 控制处理
// ============================================================

void handleControl(const char* device, const char* action) {
  if (strcmp(device, "pump") == 0) {
    if (strcmp(action, "on") == 0) {
      digitalWrite(PUMP_RELAY_PIN, HIGH);
      Serial.println("水泵已开启");
      mqttClient.publish("potato/response", "{\"device\":\"pump\",\"status\":\"on\"}");
    } else if (strcmp(action, "off") == 0) {
      digitalWrite(PUMP_RELAY_PIN, LOW);
      Serial.println("水泵已关闭");
      mqttClient.publish("potato/response", "{\"device\":\"pump\",\"status\":\"off\"}");
    }
  }
  else if (strcmp(device, "fan") == 0) {
    if (strcmp(action, "on") == 0) {
      digitalWrite(FAN_RELAY_PIN, HIGH);
      Serial.println("风扇已开启");
    } else if (strcmp(action, "off") == 0) {
      digitalWrite(FAN_RELAY_PIN, LOW);
      Serial.println("风扇已关闭");
    }
  }
}

void autoControl() {
  // 自动浇水逻辑
  float avgSoilMoisture = (sensorData.soilMoisture1 + sensorData.soilMoisture2) / 2.0;

  if (avgSoilMoisture < SOIL_MOISTURE_THRESHOLD) {
    Serial.println("土壤湿度低，触发浇水...");
    digitalWrite(PUMP_RELAY_PIN, HIGH);
    delay(3000);  // 浇水3秒
    digitalWrite(PUMP_RELAY_PIN, LOW);
    Serial.println("浇水完成");
  }

  // 自动风扇逻辑
  if (sensorData.temperature > TEMPERATURE_THRESHOLD) {
    Serial.println("温度过高，开启风扇...");
    digitalWrite(FAN_RELAY_PIN, HIGH);
  } else if (sensorData.temperature < TEMPERATURE_THRESHOLD - 2) {
    digitalWrite(FAN_RELAY_PIN, LOW);
  }
}

// ============================================================
// 传感器读取
// ============================================================

void readSensors() {
  // 读取土壤湿度 (原始值转换为百分比)
  int soilRaw1 = analogRead(SOIL_MOISTURE_PIN_1);
  int soilRaw2 = analogRead(SOIL_MOISTURE_PIN_2);

  // 转换为湿度百分比 (根据传感器校准调整)
  sensorData.soilMoisture1 = map(soilRaw1, 0, 4095, 100, 0);
  sensorData.soilMoisture2 = map(soilRaw2, 0, 4095, 100, 0);

  // 限制范围在 0-100
  sensorData.soilMoisture1 = constrain(sensorData.soilMoisture1, 0, 100);
  sensorData.soilMoisture2 = constrain(sensorData.soilMoisture2, 0, 100);

  // 读取 DHT22 温湿度
  sensorData.temperature = dht.readTemperature();
  sensorData.humidity = dht.readHumidity();

  // 检查读取是否成功
  if (isnan(sensorData.temperature) || isnan(sensorData.humidity)) {
    Serial.println("DHT22 读取失败!");
    sensorData.temperature = 0;
    sensorData.humidity = 0;
  }

  sensorData.timestamp = millis();

  // 串口打印传感器数据
  Serial.println("\n--- 传感器读数 ---");
  Serial.print("土壤湿度 1: ");
  Serial.print(sensorData.soilMoisture1);
  Serial.println(" %");

  Serial.print("土壤湿度 2: ");
  Serial.print(sensorData.soilMoisture2);
  Serial.println(" %");

  Serial.print("温度: ");
  Serial.print(sensorData.temperature);
  Serial.println(" °C");

  Serial.print("湿度: ");
  Serial.print(sensorData.humidity);
  Serial.println(" %");

  Serial.print("平均土壤湿度: ");
  Serial.print((sensorData.soilMoisture1 + sensorData.soilMoisture2) / 2.0);
  Serial.println(" %");
  Serial.println("-------------------\n");
}

void publishSensorData() {
  StaticJsonDocument<256> doc;

  doc["device_id"] = MQTT_CLIENT_ID;
  doc["soil_moisture_1"] = sensorData.soilMoisture1;
  doc["soil_moisture_2"] = sensorData.soilMoisture2;
  doc["temperature"] = sensorData.temperature;
  doc["humidity"] = sensorData.humidity;
  doc["timestamp"] = sensorData.timestamp;

  String payload;
  serializeJson(doc, payload);

  if (mqttClient.publish(MQTT_TOPIC_SENSOR, payload.c_str())) {
    Serial.println("传感器数据已发布到 MQTT");
  } else {
    Serial.println("MQTT 发布失败!");
  }
}

// ============================================================
// 摄像头设置 (ESP32-CAM)
// ============================================================

void setupCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  // 初始化时使用低分辨率，提高性能
  config.frame_size = FRAMESIZE_SVGA;
  config.jpeg_quality = 12;
  config.fb_count = 1;

  // 摄像头初始化
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("摄像头初始化失败，错误代码: 0x%x", err);
    return;
  }

  Serial.println("摄像头初始化成功!");
}

// ============================================================
// 引脚设置
// ============================================================

void setupPins() {
  pinMode(SOIL_MOISTURE_PIN_1, INPUT);
  pinMode(SOIL_MOISTURE_PIN_2, INPUT);
  pinMode(DHT_PIN, INPUT);

  pinMode(PUMP_RELAY_PIN, OUTPUT);
  pinMode(FAN_RELAY_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);

  // 初始状态: 所有继电器关闭
  digitalWrite(PUMP_RELAY_PIN, LOW);
  digitalWrite(FAN_RELAY_PIN, LOW);

  Serial.println("GPIO 引脚初始化完成");
}

// ============================================================
// 辅助函数
// ============================================================

void blinkLED(int times, int delayMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(delayMs);
    digitalWrite(LED_PIN, LOW);
    delay(delayMs);
  }
}
