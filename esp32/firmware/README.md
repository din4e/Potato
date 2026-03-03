# ESP32 固件烧录指南

> 本文档介绍如何将固件上传到 ESP32 开发板

---

## 🔧 方法一：Arduino IDE（推荐新手）

### 1. 安装 Arduino IDE

1. 下载并安装 [Arduino IDE 2.x](https://www.arduino.cc/en/software)
2. 打开 Arduino IDE

### 2. 添加 ESP32 开发板支持

1. 点击 `文件` → `首选项`
2. 在"附加开发板管理器网址"中添加：
   ```
   https://espressif.github.io/arduino-esp32/package_esp32_index.json
   ```
3. 点击 `工具` → `开发板` → `开发板管理器`
4. 搜索 "ESP32"，安装 "ESP32 by Espressif Systems"

### 3. 安装必要的库

1. 点击 `工具` → `管理库`
2. 搜索并安装以下库：
   - `PubSubClient` by Nick O'Leary
   - `DHT sensor library` by Adafruit

### 4. 打开固件文件

1. 点击 `文件` → `打开`
2. 选择 `esp32/firmware/potato_esp32.ino`

### 5. 配置开发板

点击 `工具` 菜单，设置以下选项：

| 选项 | 设置 |
|------|------|
| 开发板 | ESP32 Dev Module |
| 上传速度 | 921600 |
| CPU 频率 | 240MHz (WiFi/BT) |
| Flash 频率 | 80MHz |
| Flash 模式 | QIO |
| Flash 大小 | 4MB (32Mb) |
| 端口 | 选择你的 ESP32 端口 |

### 6. 修改配置

打开固件文件，修改以下配置：

```cpp
// WiFi 配置
const char* WIFI_SSID = "你的WiFi名称";
const char* WIFI_PASSWORD = "你的WiFi密码";

// MQTT 配置
const char* MQTT_SERVER = "192.168.1.100";  // 改成电脑IP
const int MQTT_PORT = 9000;
```

### 7. 上传固件

1. 用 USB 数据线连接 ESP32
2. 点击 `上传` 按钮 (→)
3. 等待编译和上传完成
4. 点击 `串口监视器` 查看输出

### 8. 验证运行

串口监视器应显示：
```
========================================
🥔 土豆培育系统 - ESP32 固件
========================================
连接WiFi: 你的WiFi名称
.....
✅ WiFi已连接!
IP地址: 192.168.1.xxx
🔌 连接MQTT... ✅ 已连接!
========================================
🥔 系统初始化完成!
========================================
```

---

## 🚀 方法二：PlatformIO（推荐进阶用户）

### 1. 安装 VS Code

下载并安装 [VS Code](https://code.visualstudio.com/)

### 2. 安装 PlatformIO 扩展

1. 打开 VS Code
2. 点击左侧扩展图标
3. 搜索 "PlatformIO IDE"，安装

### 3. 打开项目

```bash
cd D:/Projects/Mixed/Potato/esp32/firmware
code .
```

### 4. 修改配置

编辑 `potato_esp32.ino`，修改 WiFi 和 MQTT 配置

### 5. 选择串口

1. 点击底部状态栏的设备图标
2. 选择 ESP32 连接的 COM 端口

### 6. 编译并上传

1. 点击 `→` 图标上传
2. 或按快捷键 `Ctrl+Alt+U`

---

## 📱 方法三：esptool（命令行）

### 1. 安装 esptool

```bash
pip install esptool
```

### 2. 编译固件

使用 Arduino IDE 或 PlatformIO 编译固件，获取 `.bin` 文件

### 3. 擦除 Flash

```bash
esptool.py --chip esp32 --port COM3 erase_flash
```

### 4. 烧录固件

```bash
esptool.py --chip esp32 --port COM3 --baud 460800 \
  write_flash -z 0x1000 potato_esp32.bin
```

---

## 🔍 常见问题

### ESP32 无法连接

| 问题 | 解决方案 |
|------|----------|
| 找不到串口 | 检查 USB 线，安装 CH340 驱动 |
| 上传失败 | 按住 BOOT 键再点上传 |
| 连接超时 | 降低上传速度到 115200 |

### WiFi 连接失败

```cpp
// 检查配置是否正确
const char* WIFI_SSID = "正确名称";    // 注意大小写
const char* WIFI_PASSWORD = "正确密码"; // 注意空格
```

### MQTT 连接失败

1. 检查电脑 IP 地址是否正确
2. 确认 Docker 服务正在运行：
   ```bash
   docker compose ps
   ```
3. 确认端口映射（localhost:9000）

### 传感器读数为 0

- 检查接线是否正确
- 检查 3V3 电源是否正常
- 用万用表测试传感器输出

---

## ✅ 烧录成功检查清单

- [ ] 固件上传无错误
- [ ] 串口监视器显示 WiFi 已连接
- [ ] 串口监视器显示 MQTT 已连接
- [ ] 土壤传感器显示数值
- [ ] DHT22 显示温湿度
- [ ] Web 控制面板显示设备在线

---

## 🎯 下一步

固件烧录成功后：

1. **连接传感器** - 按照接线图连接
2. **连接水泵** - 测试继电器工作
3. **组装培育箱** - 放入种植盆和传感器
4. **播种启动** - 开始实验！

---

## 📞 技术支持

遇到问题？
- 查看串口监视器输出
- 检查接线是否正确
- 确认配置参数正确
- GitHub Issues 报告问题
