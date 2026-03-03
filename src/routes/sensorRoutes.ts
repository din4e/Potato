import { Router } from 'express';
import { sensorController } from '../controllers/sensorController.js';

const router = Router();

// GET /api/sensor/:deviceId/current - Get current sensor data
router.get('/:deviceId/current', sensorController.getCurrent.bind(sensorController));

// GET /api/sensor/:deviceId/history - Get historical sensor data
router.get('/:deviceId/history', sensorController.getHistory.bind(sensorController));

// GET /api/sensor/:deviceId/stats - Get sensor statistics
router.get('/:deviceId/stats', sensorController.getStats.bind(sensorController));

export default router;
