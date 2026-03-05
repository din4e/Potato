import { Router } from 'express';
import { streamingController } from '../controllers/streamingController.js';

const router = Router();

// GET /api/streaming/status - 获取推流状态
router.get('/status', (req, res) => streamingController.getStatus(req, res));

// GET /api/streaming/status/:platformId - 获取特定平台状态
router.get('/status/:platformId', (req, res) => streamingController.getPlatformStatus(req, res));

// POST /api/streaming/start - 开始多平台直播推流
router.post('/start', (req, res) => streamingController.startStreaming(req, res));

// POST /api/streaming/stop - 停止直播推流
router.post('/stop', (req, res) => streamingController.stopStreaming(req, res));

// PUT /api/streaming/platforms - 更新推流平台配置（运行时）
router.put('/platforms', (req, res) => streamingController.updatePlatforms(req, res));

// GET /api/streaming/recordings - 获取本地录像列表
router.get('/recordings', (req, res) => streamingController.getRecordings(req, res));

// DELETE /api/streaming/recordings/:filename - 删除录像
router.delete('/recordings/:filename', (req, res) => streamingController.deleteRecording(req, res));

// GET /api/streaming/download/:filename - 下载录像
router.get('/download/:filename', (req, res) => streamingController.downloadRecording(req, res));

// GET /api/streaming/platforms - 获取直播平台信息
router.get('/platforms', (req, res) => streamingController.getPlatforms(req, res));

// GET /api/streaming/cameras - 获取可用摄像头
router.get('/cameras', (req, res) => streamingController.getCameras(req, res));

export default router;
