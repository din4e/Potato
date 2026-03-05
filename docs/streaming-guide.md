# 🎥 直播推流方案

## 方案对比

| 方案 | 硬件要求 | 延迟 | 本地缓存 | 公开直播 | 推荐度 |
|------|----------|------|----------|----------|--------|
| **ESP32-CAM + RTMP** | ESP32-CAM | 2-5s | ❌ | ✅ | ⭐⭐ |
| **ESP32-CAM + 树莓派** | ESP32 + 树莓派 | 1-3s | ✅ | ✅ | ⭐⭐⭐⭐⭐ |
| **USB摄像头 + 服务器** | USB摄像头 | <1s | ✅ | ✅ | ⭐⭐⭐⭐ |
| **IP摄像头 + 中转** | IP Camera | 1-2s | ✅ | ✅ | ⭐⭐⭐ |

---

## 🌟 推荐方案：USB摄像头 + Node.js 中转

### 硬件清单

| 组件 | 价格 | 说明 |
|------|------|------|
| USB高清摄像头 | ¥50-100 | 推荐1080p，带麦克风 |
| 树莓派4/闲置电脑 | 0/¥300 | 运行推流服务 |
| 或直接用现有服务器 | ¥0 | 如果服务器在本地 |

### 软件依赖

```bash
# FFmpeg (推流核心)
sudo apt install ffmpeg

# Node.js 流处理库
npm install fluent-ffmpeg @ffmpeg-installer/ffmpeg
```

---

## 🚀 实现步骤

### 1. 摄像头获取视频流

```bash
# 列出可用摄像头
ffmpeg -list_devices true -f dshow -i dummy  # Windows
ffmpeg -f v4l2 -list_formats all -i /dev/video0  # Linux

# 测试摄像头
ffmpeg -f v4l2 -i /dev/video0 -f mpegts udp://localhost:5000
```

### 2. 本地缓存 + RTMP 推流

```bash
# 同时实现：本地缓存 + 网页观看 + RTMP推流
ffmpeg -f v4l2 -i /dev/video0 \
  -c:v libx264 -preset veryfast -b:v 2000k \
  -c:a aac -b:a 128k \
  -f tee \
  -map 0:v -map 0:a \
  "[f=flv]rtmp://live-push.bilivideo.com/live-bvc/你的直播码|[f=segment]segment_%03d.mp4"
```

### 3. 直播平台推流地址

| 平台 | RTMP地址 |
|------|----------|
| **B站** | `rtmp://live-push.bilivideo.com/live-bvc/` |
| **抖音** | `rtmp://push.douyin.com/live/` |
| **YouTube** | `rtmp://a.rtmp.youtube.com/live2/` |
| **快手** | `rtmp://push.kuaishou.com/live/` |

---

## 💻 Node.js 实现

创建 `src/services/streamingService.ts`:

```typescript
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';

interface StreamingConfig {
  // 摄像头输入
  input: string;  // /dev/video0 或 'video=摄像头名称'

  // 本地缓存
  cacheDir: string;
  segmentTime: number;  // 每段时长(秒)

  // RTMP 推流
  rtmpUrl: string;
  rtmpKey: string;

  // WebRTC/网页流
  httpPort: number;
}

class StreamingService {
  private ffmpegProcess: any = null;
  private isStreaming = false;

  async startStreaming(config: StreamingConfig) {
    const cachePath = path.join(config.cacheDir, 'segment_%03d.mp4');

    this.ffmpegProcess = ffmpeg(config.input)
      .inputOptions([
        '-f', 'v4l2',           // Linux摄像头
        '-video_size', '1280x720',
        '-framerate', '30',
        '-i', 'default'         // 默认音频
      ])
      .videoCodec('libx264')
      .videoBitrate('2000k')
      .size('1280x720')
      .outputOptions([
        '-preset', 'veryfast',
        '-tune', 'zerolatency',
        '-g', '30',             // 关键帧间隔
        '-c:a', 'aac',
        '-b:a', '128k',
        '-f', 'tee',           // 多路输出
        '-map', '0:v',
        '-map', '0:a',
        '-f', 'flv'
      ])
      .output(`${config.rtmpUrl}${config.rtmpKey}`)
      .output(cachePath)
      .on('start', (cmd) => {
        console.log('FFmpeg started:', cmd);
        this.isStreaming = true;
      })
      .on('error', (err) => {
        console.error('FFmpeg error:', err);
        this.isStreaming = false;
      });

    this.ffmpegProcess.run();
  }

  stopStreaming() {
    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill();
      this.isStreaming = false;
    }
  }

  getStatus() {
    return {
      streaming: this.isStreaming,
      startTime: this.startTime,
      viewers: this.getViewerCount()
    };
  }

  // 获取本地录像列表
  getRecordings() {
    const files = fs.readdirSync(CACHE_DIR);
    return files.filter(f => f.endsWith('.mp4'));
  }
}
```

---

## 📱 前端直播播放器

```html
<!-- HLS 播放 (低延迟) -->
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>

<video id="livePlayer" controls autoplay></video>

<script>
const video = document.getElementById('livePlayer');
const hls = new Hls();
hls.loadSource('/api/stream/live.m3u8');
hls.attachMedia(video);
</script>
```

---

## 🔄 ESP32-CAM 方案（可选）

如果坚持使用 ESP32-CAM：

### 优点
- 价格便宜（¥25）
- 无线部署方便
- 低功耗

### 缺点
- 画质一般（最高SVGA）
- 需要额外中转设备

### 实现方式
```
ESP32-CAM → HTTP Stream → 树莓派 → FFmpeg → RTMP
```

树莓派上的脚本：
```bash
#!/bin/bash
# 从ESP32-CAM获取流并推流

CAMERA_URL="http://192.168.1.101:81/stream"
RTMP_URL="rtmp://live-push.bilivideo.com/live-bvc/你的码"

ffmpeg -i "$CAMERA_URL" \
  -c:v libx264 -preset fast -b:v 1500k \
  -maxrate 1500k -bufsize 3000k \
  -g 30 -c:a aac -b:a 128k \
  -f flv "$RTMP_URL"
```

---

## 🎯 推荐配置

### 轻量级（预算 < ¥200）
- USB 摄像头（¥80）
- 使用现有电脑/服务器

### 标准级（预算 < ¥500）
- USB 摄像头（¥100）
- 树莓派 4B 2G（¥300）
- 32GB SD卡（¥50）

### 专业级（预算 < ¥1000）
- 高清 USB 摄像头（¥300）
- 树莓派 4B 8G（¥500）
+ 云存储备份
