import { Request, Response } from 'express';
import { sensorService } from '../services/index.js';
import { ApiResponse } from '../types/index.js';

export class SensorController {
  async getCurrent(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId } = req.params;
      const data = await sensorService.getCurrentData(deviceId);

      if (!data) {
        res.json(<ApiResponse>{
          success: false,
          error: 'Device not found or no data available',
        });
        return;
      }

      res.json(<ApiResponse>{
        success: true,
        data,
      });
    } catch (error) {
      res.status(500).json(<ApiResponse>{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getHistory(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId } = req.params;
      const hours = parseInt(req.query.hours as string) || 24;
      const data = await sensorService.getHistoryData(deviceId, hours);

      res.json(<ApiResponse>{
        success: true,
        data,
      });
    } catch (error) {
      res.status(500).json(<ApiResponse>{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId } = req.params;
      const hours = parseInt(req.query.hours as string) || 24;
      const stats = await sensorService.getStats(deviceId, hours);

      res.json(<ApiResponse>{
        success: true,
        data: stats,
      });
    } catch (error) {
      res.status(500).json(<ApiResponse>{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const sensorController = new SensorController();
