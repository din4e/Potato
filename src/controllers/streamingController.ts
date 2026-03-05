import { Request, Response } from 'express';
import { streamingService, StreamingService, PlatformStream } from '../services/streamingService.js';
import { ApiResponse } from '../types/index.js';

export class StreamingController {
  /**
   * 获取推流服务状态
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = streamingService.getStatus();
      const ffmpegAvailable = await StreamingService.checkFFmpeg();
      const cameras = await StreamingService.listCameras();

      res.json(<ApiResponse>{
        success: true,
        data: {
          ...status,
          ffmpegAvailable,
          cameras,
          platforms: StreamingService.getPlatformInfo()
        }
      });
    } catch (error) {
      res.status(500).json(<ApiResponse>{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * 开始多平台直播推流
   */
  async startStreaming(req: Request, res: Response): Promise<void> {
    try {
      const { platforms } = req.body;

      // 检查 FFmpeg 是否可用
      const ffmpegAvailable = await StreamingService.checkFFmpeg();
      if (!ffmpegAvailable) {
        res.status(400).json(<ApiResponse>{
          success: false,
          error: 'FFmpeg is not installed or not available'
        });
        return;
      }

      // 验证平台配置
      if (!platforms || !Array.isArray(platforms)) {
        res.status(400).json(<ApiResponse>{
          success: false,
          error: 'Platforms array is required'
        });
        return;
      }

      // 检查至少有一个平台启用且配置完整
      const enabledPlatforms = platforms.filter((p: PlatformStream) => {
        return p.enabled && p.rtmpUrl && p.rtmpKey;
      });

      if (enabledPlatforms.length === 0) {
        res.status(400).json(<ApiResponse>{
          success: false,
          error: 'At least one platform must be enabled with RTMP URL and key'
        });
        return;
      }

      // 自动填充平台 RTMP 地址
      const platformInfo = StreamingService.getPlatformInfo();
      const processedPlatforms = platforms.map((p: PlatformStream) => {
        if (p.id && p.id !== 'custom' && !p.rtmpUrl && platformInfo[p.id]) {
          p.rtmpUrl = platformInfo[p.id].rtmpUrl;
        }
        return p;
      });

      await streamingService.startStreaming(processedPlatforms);

      res.json(<ApiResponse>{
        success: true,
        message: `Streaming started to ${enabledPlatforms.length} platform(s)`,
        data: {
          platforms: enabledPlatforms.map(p => p.id),
          status: streamingService.getStatus()
        }
      });
    } catch (error) {
      res.status(500).json(<ApiResponse>{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * 停止直播推流
   */
  async stopStreaming(req: Request, res: Response): Promise<void> {
    try {
      streamingService.stopStreaming();

      res.json(<ApiResponse>{
        success: true,
        message: 'Streaming stopped'
      });
    } catch (error) {
      res.status(500).json(<ApiResponse>{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * 更新推流平台配置（运行时）
   */
  async updatePlatforms(req: Request, res: Response): Promise<void> {
    try {
      const { platforms } = req.body;

      await streamingService.updatePlatforms(platforms);

      res.json(<ApiResponse>{
        success: true,
        message: 'Platform configuration updated',
        data: streamingService.getStatus()
      });
    } catch (error) {
      res.status(500).json(<ApiResponse>{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * 获取本地录像列表
   */
  async getRecordings(req: Request, res: Response): Promise<void> {
    try {
      const recordings = await streamingService.getRecordings();

      res.json(<ApiResponse>{
        success: true,
        data: recordings
      });
    } catch (error) {
      res.status(500).json(<ApiResponse>{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * 删除录像
   */
  async deleteRecording(req: Request, res: Response): Promise<void> {
    try {
      const { filename } = req.params;
      const success = await streamingService.deleteRecording(filename);

      res.json(<ApiResponse>{
        success,
        message: success ? 'Recording deleted' : 'Failed to delete recording'
      });
    } catch (error) {
      res.status(500).json(<ApiResponse>{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * 下载录像
   */
  async downloadRecording(req: Request, res: Response): Promise<void> {
    try {
      const { filename } = req.params;
      const path = require('path');
      const recordingsDir = path.join(process.cwd(), 'recordings');
      const filePath = path.join(recordingsDir, filename);

      res.download(filePath, filename, (err) => {
        if (err) {
          res.status(404).json(<ApiResponse>{
            success: false,
            error: 'File not found'
          });
        }
      });
    } catch (error) {
      res.status(500).json(<ApiResponse>{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * 获取直播平台信息
   */
  async getPlatforms(req: Request, res: Response): Promise<void> {
    try {
      const platforms = StreamingService.getPlatformInfo();

      res.json(<ApiResponse>{
        success: true,
        data: platforms
      });
    } catch (error) {
      res.status(500).json(<ApiResponse>{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * 获取可用摄像头
   */
  async getCameras(req: Request, res: Response): Promise<void> {
    try {
      const cameras = await StreamingService.listCameras();

      res.json(<ApiResponse>{
        success: true,
        data: cameras
      });
    } catch (error) {
      res.status(500).json(<ApiResponse>{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * 获取特定平台状态
   */
  async getPlatformStatus(req: Request, res: Response): Promise<void> {
    try {
      const { platformId } = req.params;
      const status = streamingService.getPlatformStatus(platformId);

      if (!status) {
        res.status(404).json(<ApiResponse>{
          success: false,
          error: 'Platform not found'
        });
        return;
      }

      res.json(<ApiResponse>{
        success: true,
        data: status
      });
    } catch (error) {
      res.status(500).json(<ApiResponse>{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const streamingController = new StreamingController();
