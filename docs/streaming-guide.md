# 🎥 直播推流完整指南

> 土豆培育系统 - 多平台同时直播推流方案

---

## 📑 目录

1. [方案对比](#方案对比)
2. [多平台同时推流](#多平台同时推流)
3. [快速开始](#快速开始)
4. [平台配置](#平台配置)
5. [API 接口](#api-接口)
6. [常见问题](#常见问题)

---

## 方案对比

| 方案 | 硬件要求 | 延迟 | 多平台 | 本地缓存 | 推荐度 |
|------|----------|------|--------|----------|--------|
| **ESP32-CAM + RTMP** | ESP32-CAM | 2-5s | ❌ | ❌ | ⭐⭐ |
| **ESP32-CAM + 树莓派** | ESP32 + 树莓派 | 1-3s | ⚠️ | ✅ | ⭐⭐⭐ |
| **USB摄像头 + 服务器** | USB摄像头 | <1s | ✅ | ✅ | ⭐⭐⭐⭐⭐ |
| **IP摄像头 + 中转** | IP Camera | 1-2s | ✅ | ✅ | ⭐⭐⭐⭐ |

---

## 多平台同时推流

### 🎯 核心特性

本系统支持 **一次开播，同时推流到多个平台**：

- ✅ B站 (bilibili)
- ✅ 抖音 (douyin)
- ✅ YouTube Live
- ✅ 快手 (kuaishou)
- ✅ 自定义 RTMP

### 📊 工作原理

```
┌─────────────┐
│  USB Camera │
│  /dev/video0│
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│         Node.js 推流服务            │
│         (FFmpeg tee muxer)         │
└───────┬─────────────────────────────┘
        │
        ├──► B站 (rtmp://live-push.bilivideo.com/...)
        ├──► 抖音 (rtmp://push.douyin.com/...)
        ├──► YouTube (rtmp://a.rtmp.youtube.com/...)
        ├──► 快手 (rtmp://push.kuaishou.com/...)
        ├──► 本地录像 (recordings/*.mp4)
        └──► HLS 网页直播 (http://server/hls/stream.m3u8)
```

---

## 快速开始

### 1. 系统要求

```bash
# FFmpeg (必须)
sudo apt install ffmpeg  # Linux
# Windows: 下载 FFmpeg 并添加到 PATH

# 验证安装
ffmpeg -version
```

### 2. 硬件清单

| 组件 | 推荐配置 | 价格 |
|------|----------|------|
| USB 摄像头 | 1080p，带麦克风 | ¥50-100 |
| 推流主机 | 树莓派4/闲置电脑 | 0/¥300 |
| 网络上行 | 10Mbps+ (多平台) | - |

### 3. 启动服务

```bash
cd potato
npm install
npm run dev
```

访问：http://localhost:7777 → 🎥 直播推流

### 4. 开播步骤

1. **选择平台** - 打开要推流的平台开关
2. **输入密钥** - 填入各平台的推流码
3. **调整画质** - 选择分辨率和码率
4. **开始直播** - 点击「🔴 开始全平台直播」

---

## 平台配置

### B站直播

```
RTMP 地址: rtmp://live-push.bilivideo.com/live-bvc/
推流码获取: 直播中心 → 直播开播 → 推流码
推荐画质: 720p, 2000kbps
```

### 抖音直播

```
RTMP 地址: rtmp://push.douyin.com/live/
推流码获取: 抖音伴侣 → 推流设置
推荐画质: 720p, 2000kbps
```

### YouTube Live

```
RTMP 地址: rtmp://a.rtmp.youtube.com/live2/
推流码获取: YouTube Studio → 直播控制台 → 流密钥
推荐画质: 720p, 2000-4500kbps
```

### 快手直播

```
RTMP 地址: rtmp://push.kuaishou.com/live/
推流码获取: 快手直播伴侣 → 推流设置
推荐画质: 720p, 2000kbps
```

---

## 码率建议

| 平台数量 | 分辨率 | 码率 | 上行带宽要求 |
|----------|--------|------|--------------|
| 1个平台 | 1080p | 2000kbps | 3Mbps |
| 2个平台 | 1080p | 2500kbps | 5Mbps |
| 3个平台 | 720p | 3000kbps | 8Mbps |
| 4个平台 | 720p | 3500kbps | 10Mbps |

---

## API 接口

### 获取推流状态

```bash
GET /api/streaming/status
```

响应：
```json
{
  "success": true,
  "data": {
    "active": false,
    "startTime": null,
    "platforms": {
      "bilibili": {
        "name": "B站直播",
        "rtmpUrl": "rtmp://live-push.bilivideo.com/live-bvc/",
        "icon": "📺"
      }
    },
    "ffmpegAvailable": true,
    "cameras": [
      {"name": "USB Camera", "id": "video=USB Camera"}
    ]
  }
}
```

### 开始多平台推流

```bash
POST /api/streaming/start
Content-Type: application/json

{
  "platforms": [
    {
      "id": "bilibili",
      "name": "B站直播",
      "enabled": true,
      "rtmpUrl": "rtmp://live-push.bilivideo.com/live-bvc/",
      "rtmpKey": "你的B站推流码"
    },
    {
      "id": "douyin",
      "name": "抖音直播",
      "enabled": true,
      "rtmpUrl": "rtmp://push.douyin.com/live/",
      "rtmpKey": "你的抖音推流码"
    },
    {
      "id": "youtube",
      "name": "YouTube Live",
      "enabled": true,
      "rtmpUrl": "rtmp://a.rtmp.youtube.com/live2/",
      "rtmpKey": "你的YouTube流密钥"
    }
  ],
  "cameraSource": "/dev/video0",
  "resolution": "1280x720",
  "bitrate": "2500k",
  "enableCache": true
}
```

响应：
```json
{
  "success": true,
  "message": "Streaming started to 3 platform(s)",
  "data": {
    "platforms": ["bilibili", "douyin", "youtube"],
    "status": { ... }
  }
}
```

### 停止推流

```bash
POST /api/streaming/stop
```

### 获取录像列表

```bash
GET /api/streaming/recordings
```

### 下载录像

```bash
GET /api/streaming/download/:filename
```

---

## 前端界面

### 界面布局

```
┌─────────────────────────────────────────────────────────────┐
│  🎥 直播推流                                                │
├─────────────────────────────────────────────────────────────┤
│  状态: ● 直播中  |  平台: 3个  |  录制: ● 录制中  |  时长  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐      │
│  │   B站   │  │   抖音  │  │ YouTube│  │   快手  │      │
│  │  📺 [ON]│  │  🎵 [ON]│  │  ▶️ [ON]│  │  ⚡ [OFF]│      │
│  │ 推流中..│  │ 推流中..│  │ 推流中..│  │         │      │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘      │
│                                                             │
│  摄像头: [USB Camera ▼]  分辨率: [720p ▼]  码率: [2500k ▼]│
│  ☑ 同时保存本地录像                                        │
│                                                             │
│  [🔴 开始全平台直播]  [⬛ 停止直播]                         │
├─────────────────────────────────────────────────────────────┤
│  🌐 网页直播预览                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │              [HLS 视频播放器]                        │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  📼 本地录像                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📼 recording-2024-03-05-12-30-00.mp4  125MB  ⬇️ 🗑️ │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## HLS 网页播放

```html
<!-- HLS 低延迟播放 -->
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>

<video id="livePlayer" controls autoplay muted></video>

<script>
const video = document.getElementById('livePlayer');
const hls = new Hls();

// HLS 直播流地址
hls.loadSource('http://localhost:7777/hls/stream.m3u8');
hls.attachMedia(video);

// 低延迟配置
hls.config.maxBufferLength = 1;
hls.config.maxMaxBufferLength = 1;
</script>
```

---

## FFmpeg 命令参考

### 单平台推流

```bash
ffmpeg -f v4l2 -i /dev/video0 \
  -c:v libx264 -preset veryfast -b:v 2000k \
  -c:a aac -b:a 128k \
  -f flv rtmp://live-push.bilivideo.com/live-bvc/你的码
```

### 多平台同时推流 (tee muxer)

```bash
ffmpeg -f v4l2 -i /dev/video0 \
  -c:v libx264 -preset veryfast -b:v 2500k \
  -c:a aac -b:a 128k \
  -map 0:v -map 0:a \
  -f tee \
  "[f=flv]rtmp://bili-url/key|[f=flv]rtmp://douyin-url/key|[f=flv]rtmp://youtube-url/key|[f=mp4]recording.mp4"
```

### 带 HLS 输出

```bash
ffmpeg -f v4l2 -i /dev/video0 \
  -c:v libx264 -preset veryfast -b:v 2000k \
  -c:a aac -b:a 128k \
  -map 0:v -map 0:a \
  -f tee \
  "[f=flv]rtmp://bili-url/key|[f=hls:hls_time=2:hls_list_size=5]/hls/stream.m3u8"
```

---

## 常见问题

### Q: FFmpeg 未安装或不在 PATH 中？

```bash
# Linux
sudo apt install ffmpeg

# Windows
# 1. 下载 FFmpeg: https://ffmpeg.org/download.html
# 2. 解压到 C:\ffmpeg
# 3. 添加到系统 PATH: C:\ffmpeg\bin
# 4. 重启终端
```

### Q: 摄像头无法访问？

```bash
# Linux 权限问题
sudo usermod -a -G video $USER
# 重新登录后生效

# 检查摄像头
ls -l /dev/video*
```

### Q: 推流卡顿？

1. 降低分辨率：720p → 480p
2. 降低码率：2500k → 1500k
3. 减少同时推流的平台数量
4. 检查网络上行带宽

### Q: 某个平台推流失败？

- 检查推流密钥是否正确
- 确认平台直播功能已开启
- 查看服务器日志获取详细错误信息

### Q: 如何在 Docker 中使用？

```dockerfile
FROM node:18
RUN apt-get update && apt-get install -y ffmpeg
COPY . /app
WORKDIR /app
RUN npm install
CMD ["npm", "start"]
```

需要挂载摄像头设备：
```bash
docker run --device=/dev/video0 ...
```

---

## 高级配置

### 自定义 FFmpeg 参数

编辑 `src/services/streamingService.ts`：

```typescript
const args = [
  // 输入配置
  '-f', 'v4l2',
  '-video_size', '1920x1080',
  '-framerate', '60',
  '-i', '/dev/video0',

  // 视频编码
  '-c:v', 'libx264',
  '-preset', 'fast',
  '-b:v', '4500k',
  '-maxrate', '4500k',
  '-bufsize', '9000k',
  '-g', '30',
  '-sc_threshold', '0',

  // 音频编码
  '-c:a', 'aac',
  '-b:a', '192k',
  '-ar', '48000',

  // 多路输出
  '-map', '0:v',
  '-map', '0:a',
  '-f', 'tee',
  '-tee', outputs.join('|')
];
```

### NVIDIA NVENC 硬件编码

```bash
# 安装 NVIDIA 驱动和 CUDA
# 使用 GPU 编码器
ffmpeg -f v4l2 -i /dev/video0 \
  -c:v h264_nvenc -b:v 5000k \
  -c:a aac -b:a 128k \
  -f flv rtmp://...
```

---

## 录像管理

### 自动清理旧录像

系统会自动清理超过大小限制的旧录像：

- 默认最大缓存：5GB
- 超出后自动删除最旧的录像

### 手动下载/删除

```bash
# 下载录像
GET /api/streaming/download/recording-2024-03-05-12-30-00.mp4

# 删除录像
DELETE /api/streaming/recordings/recording-2024-03-05-12-30-00.mp4
```

---

## 性能优化

### CPU 优化

```typescript
// 使用更快的预设
preset: 'ultrafast'  // 牺牲画质换取速度
preset: 'veryfast'   // 推荐
preset: 'fast'       // 平衡
preset: 'medium'     // 更好画质
```

### 网络优化

```typescript
// 调整缓冲区
'-bufsize', '5000k',   // 减少缓冲
'-maxrate', '2500k',   // 限制最大码率
```

### 多进程推流

对于特别多平台，可考虑使用多个 FFmpeg 进程并行编码。

---

## 安全建议

1. **不要在代码中硬编码推流密钥**
2. **使用环境变量存储敏感信息**
3. **限制 API 访问权限**
4. **定期清理本地录像文件**

---

## 相关文档

- [硬件方案](./hardware-detailed.md)
- [待办事项](./TODO.md)
- [API 文档](../README.md#api-文档)

---

*最后更新: 2024-03-05*
*版本: v2.0 - 多平台推流*
