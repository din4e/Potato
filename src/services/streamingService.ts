import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { logger } from '../utils/logger.js';

interface StreamingConfig {
  // 摄像头配置
  inputSource: string;     // Linux: /dev/video0, Windows: 'video=摄像头名'
  inputFormat: string;     // v4l2 (Linux) or dshow (Windows)
  resolution: string;      // 1280x720
  framerate: number;       // 30

  // 视频编码
  videoCodec: string;      // libx264
  videoBitrate: string;    // 2000k
  preset: string;          // veryfast, fast, medium

  // 音频配置
  audioCodec: string;      // aac
  audioBitrate: string;    // 128k

  // 本地缓存
  cacheDir: string;
  segmentTime: number;     // 每段时长(秒)
  maxCacheSize: number;    // 最大缓存(MB)

  // 多平台 RTMP 推流配置
  platforms: PlatformStream[];
}

interface PlatformStream {
  id: string;              // bilibili, douyin, youtube, custom
  name: string;            // 平台显示名称
  enabled: boolean;
  rtmpUrl: string;
  rtmpKey: string;
  status: 'idle' | 'streaming' | 'error';
  error?: string;
}

interface StreamStatus {
  active: boolean;
  startTime: Date | null;
  platforms: PlatformStream[];
  viewers: number;
  recording: boolean;
  recordingPath: string | null;
  duration: number;        // 推流时长(秒)
}

/**
 * 直播推流服务 - 支持多平台同时推流
 *
 * 功能：
 * - 同时推流到 B站/抖音/YouTube 等多个平台
 * - 本地视频缓存录像
 * - HLS 网页直播
 * - 独立的平台状态监控
 */
export class StreamingService {
  private masterProcess: ChildProcess | null = null;
  private platformProcesses: Map<string, ChildProcess> = new Map();
  private config: StreamingConfig;
  private status: StreamStatus = {
    active: false,
    startTime: null,
    platforms: [],
    viewers: 0,
    recording: false,
    recordingPath: null,
    duration: 0
  };

  // 用于多进程间通信的流管道
  private streamPipePath: string;

  constructor(config?: Partial<StreamingConfig>) {
    this.streamPipePath = process.platform === 'win32'
      ? '\\\\.\\pipe\\potato_stream'
      : '/tmp/potato_stream_pipe';

    this.config = {
      // 默认配置
      inputSource: process.platform === 'win32' ? 'video=USB Camera' : '/dev/video0',
      inputFormat: process.platform === 'win32' ? 'dshow' : 'v4l2',
      resolution: '1280x720',
      framerate: 30,
      videoCodec: 'libx264',
      videoBitrate: '2500k', // 提高码率支持多路
      preset: 'veryfast',
      audioCodec: 'aac',
      audioBitrate: '128k',
      cacheDir: path.join(process.cwd(), 'recordings'),
      segmentTime: 300,
      maxCacheSize: 5000,
      platforms: []
    };
  }

  /**
   * 初始化目录
   */
  async init(): Promise<void> {
    if (!existsSync(this.config.cacheDir)) {
      await fs.mkdir(this.config.cacheDir, { recursive: true });
    }
    const hlsDir = path.join(process.cwd(), 'public', 'hls');
    if (!existsSync(hlsDir)) {
      await fs.mkdir(hlsDir, { recursive: true });
    }
    logger.info('Streaming service initialized');
  }

  /**
   * 开始多平台推流
   */
  async startStreaming(platforms: PlatformStream[]): Promise<void> {
    if (this.status.active) {
      throw new Error('Stream is already active');
    }

    // 过滤启用的平台
    const enabledPlatforms = platforms.filter(p => p.enabled && p.rtmpUrl && p.rtmpKey);
    if (enabledPlatforms.length === 0) {
      throw new Error('At least one platform must be enabled with valid RTMP credentials');
    }

    this.config.platforms = enabledPlatforms;
    this.status.platforms = enabledPlatforms.map(p => ({ ...p, status: 'idle' as const }));
    this.status.active = true;
    this.status.startTime = new Date();

    // 启动推流
    await this.startMultiPlatformStream(enabledPlatforms);

    // 启动计时器
    this.startDurationTimer();

    logger.info(`Multi-platform streaming started: ${enabledPlatforms.map(p => p.id).join(', ')}`);
  }

  /**
   * 启动多平台推流 - 使用 FFmpeg tee muxer
   */
  private async startMultiPlatformStream(platforms: PlatformStream[]): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // 构建输出列表
    const outputs: string[] = [];

    // 1. 本地缓存录像
    const cacheFile = path.join(this.config.cacheDir, `recording-${timestamp}.mp4`);
    outputs.push(`[f=mp4]${cacheFile}`);
    this.status.recording = true;
    this.status.recordingPath = this.config.cacheDir;

    // 2. HLS 输出
    const hlsPath = path.join(process.cwd(), 'public', 'hls', 'stream.m3u8');
    outputs.push(`[f=hls:hls_time=2:hls_list_size=5]${hlsPath}`);

    // 3. 各平台 RTMP 输出
    for (const platform of platforms) {
      const rtmpDest = `${platform.rtmpUrl}${platform.rtmpKey}`;
      outputs.push(`[f=flv]${rtmpDest}`);
    }

    // 构建 FFmpeg 命令 - 使用 tee muxer 同时推流到多个目标
    const args = this.buildFFmpegArgs(outputs);

    logger.info(`Starting FFmpeg multi-platform stream: ${args.join(' ')}`);

    // 启动 FFmpeg 进程
    this.masterProcess = spawn('ffmpeg', args);

    // 监听进程输出
    this.masterProcess.stdout?.on('data', (data) => {
      logger.debug(`FFmpeg: ${data.toString()}`);
    });

    this.masterProcess.stderr?.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('frame=')) {
        this.parseStreamStatus(msg);
      }
      // 检测错误
      if (msg.includes('Connection refused') || msg.includes('Network error')) {
        logger.warn('Stream connection issue detected');
      }
    });

    this.masterProcess.on('error', (error) => {
      logger.error(`FFmpeg error: ${error.message}`);
      this.stopStreaming();
    });

    this.masterProcess.on('close', (code) => {
      logger.info(`FFmpeg process exited with code ${code}`);
      this.stopStreaming();
    });

    // 更新平台状态
    for (const platform of this.status.platforms) {
      if (platform.enabled) {
        platform.status = 'streaming';
      }
    }
  }

  /**
   * 停止所有推流
   */
  stopStreaming(): void {
    if (this.masterProcess) {
      logger.info('Stopping multi-platform stream...');
      this.masterProcess.kill('SIGTERM');

      // 等待进程结束
      setTimeout(() => {
        if (this.masterProcess && !this.masterProcess.killed) {
          this.masterProcess.kill('SIGKILL');
        }
      }, 5000);

      this.masterProcess = null;
    }

    // 停止所有平台进程
    for (const [id, proc] of this.platformProcesses) {
      proc.kill();
      this.platformProcesses.delete(id);
    }

    // 重置状态
    this.status.active = false;
    this.status.startTime = null;
    this.status.duration = 0;
    this.status.recording = false;

    for (const platform of this.status.platforms) {
      platform.status = 'idle';
      platform.error = undefined;
    }

    if (this.durationTimer) {
      clearInterval(this.durationTimer);
      this.durationTimer = null;
    }

    logger.info('Multi-platform streaming stopped');
  }

  /**
   * 更新推流配置（运行时添加/移除平台）
   */
  async updatePlatforms(platforms: PlatformStream[]): Promise<void> {
    if (!this.status.active) {
      throw new Error('Stream is not active');
    }

    // 找出需要添加和移除的平台
    const currentEnabled = this.status.platforms.filter(p => p.enabled);
    const newEnabled = platforms.filter(p => p.enabled);

    const toRemove = currentEnabled.filter(cp => !newEnabled.find(np => np.id === cp.id));
    const toAdd = newEnabled.filter(np => !currentEnabled.find(cp => cp.id === np.id));

    // 如果有变化，需要重启流
    if (toRemove.length > 0 || toAdd.length > 0) {
      logger.info(`Platform configuration changed, restarting stream...`);
      this.stopStreaming();
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.startStreaming(platforms);
    }
  }

  /**
   * 获取当前状态
   */
  getStatus(): StreamStatus {
    return { ...this.status };
  }

  /**
   * 获取特定平台的状态
   */
  getPlatformStatus(platformId: string): PlatformStream | undefined {
    return this.status.platforms.find(p => p.id === platformId);
  }

  /**
   * 构建 FFmpeg 命令参数
   */
  private buildFFmpegArgs(outputs: string[]): string[] {
    const args = [
      // 输入配置
      '-f', this.config.inputFormat,
      '-video_size', this.config.resolution,
      '-framerate', this.config.framerate.toString(),
      '-i', this.config.inputSource,

      // 视频编码
      '-c:v', this.config.videoCodec,
      '-preset', this.config.preset,
      '-b:v', this.config.videoBitrate,
      '-maxrate', this.config.videoBitrate,
      '-bufsize', `${parseInt(this.config.videoBitrate) * 2}k`,
      '-g', '30', // GOP 大小
      '-sc_threshold', '0', // 禁用场景切换检测

      // 音频编码
      '-c:a', this.config.audioCodec,
      '-b:a', this.config.audioBitrate,
      '-ar', '44100',

      // 多路输出使用 tee muxer
      '-map', '0:v',
      '-map', '0:a?',
      '-f', 'tee',
      '-tee', outputs.join('|'),
    ];

    return args;
  }

  /**
   * 解析 FFmpeg 输出
   */
  private parseStreamStatus(output: string): void {
    // 可以解析推流状态，如 fps、码率等
  }

  /**
   * 推流时长计时器
   */
  private durationTimer: NodeJS.Timeout | null = null;

  private startDurationTimer(): void {
    this.durationTimer = setInterval(() => {
      if (this.status.startTime) {
        this.status.duration = Math.floor((Date.now() - this.status.startTime.getTime()) / 1000);
      }
    }, 1000);
  }

  /**
   * 获取本地录像列表
   */
  async getRecordings(): Promise<Array<{ name: string; size: string; date: Date }>> {
    try {
      const files = await fs.readdir(this.config.cacheDir);
      const recordings = [];

      for (const file of files) {
        if (file.endsWith('.mp4')) {
          const filePath = path.join(this.config.cacheDir, file);
          const stats = await fs.stat(filePath);
          recordings.push({
            name: file,
            size: this.formatFileSize(stats.size),
            date: stats.mtime
          });
        }
      }

      return recordings.sort((a, b) => b.date.getTime() - a.date.getTime());
    } catch (error) {
      logger.error('Failed to get recordings:', error);
      return [];
    }
  }

  /**
   * 删除录像
   */
  async deleteRecording(filename: string): Promise<boolean> {
    try {
      const filePath = path.join(this.config.cacheDir, filename);
      await fs.unlink(filePath);
      logger.info(`Deleted recording: ${filename}`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete recording: ${filename}`, error);
      return false;
    }
  }

  /**
   * 清理旧录像
   */
  async cleanupOldRecordings(): Promise<void> {
    try {
      const recordings = await this.getRecordings();
      let totalSize = 0;

      for (const rec of recordings) {
        const filePath = path.join(this.config.cacheDir, rec.name);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      }

      const maxSizeBytes = this.config.maxCacheSize * 1024 * 1024;
      while (totalSize > maxSizeBytes && recordings.length > 0) {
        const oldest = recordings.pop()!;
        const filePath = path.join(this.config.cacheDir, oldest.name);
        const stats = await fs.stat(filePath);
        totalSize -= stats.size;
        await fs.unlink(filePath);
        logger.info(`Cleaned up old recording: ${oldest.name}`);
      }
    } catch (error) {
      logger.error('Failed to cleanup recordings:', error);
    }
  }

  /**
   * 格式化文件大小
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  }

  /**
   * 检查 FFmpeg 是否可用
   */
  static async checkFFmpeg(): Promise<boolean> {
    return new Promise((resolve) => {
      const process = spawn('ffmpeg', ['-version']);
      process.on('error', () => resolve(false));
      process.on('close', (code) => resolve(code === 0));
    });
  }

  /**
   * 获取可用摄像头列表
   */
  static async listCameras(): Promise<Array<{ name: string; id: string }>> {
    if (process.platform === 'win32') {
      return [
        { name: 'USB Camera', id: 'video=USB Camera' },
        { name: 'HD Webcam', id: 'video=HD Webcam' },
        { name: 'Integrated Camera', id: 'video=Integrated Camera' },
      ];
    }

    const cameras: Array<{ name: string; id: string }> = [];
    for (let i = 0; i < 10; i++) {
      const device = `/dev/video${i}`;
      if (existsSync(device)) {
        cameras.push({ name: `Camera ${i}`, id: device });
      }
    }
    return cameras;
  }

  /**
   * 获取直播平台信息
   */
  static getPlatformInfo(): Record<string, { name: string; rtmpUrl: string; helpUrl: string; color: string; icon: string }> {
    return {
      bilibili: {
        name: 'B站直播',
        rtmpUrl: 'rtmp://live-push.bilivideo.com/live-bvc/',
        helpUrl: 'https://link.bilibili.com/p/help/index#/live-tool',
        color: '#FB7299',
        icon: '📺'
      },
      douyin: {
        name: '抖音直播',
        rtmpUrl: 'rtmp://push.douyin.com/live/',
        helpUrl: 'https://www.douyin.com/',
        color: '#000000',
        icon: '🎵'
      },
      youtube: {
        name: 'YouTube Live',
        rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2/',
        helpUrl: 'https://www.youtube.com/live_dashboard',
        color: '#FF0000',
        icon: '▶️'
      },
      kuaishou: {
        name: '快手直播',
        rtmpUrl: 'rtmp://push.kuaishou.com/live/',
        helpUrl: 'https://live.kuaishou.com/',
        color: '#FF6600',
        icon: '⚡'
      },
      custom: {
        name: '自定义 RTMP',
        rtmpUrl: '',
        helpUrl: '',
        color: '#64748b',
        icon: '🔗'
      }
    };
  }
}

// 导出类型
export type { PlatformStream, StreamStatus, StreamingConfig };

// 导出单例
export const streamingService = new StreamingService();
