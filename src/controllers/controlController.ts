import { Request, Response } from 'express';
import { controlService, scheduleService } from '../services/index.js';
import { irrigationModel } from '../models/index.js';
import { ApiResponse } from '../types/index.js';

export class ControlController {
  async controlPump(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId } = req.params;
      const { action, duration } = req.body;

      if (action !== 'on' && action !== 'off') {
        res.status(400).json(<ApiResponse>{
          success: false,
          error: 'Invalid action. Must be "on" or "off"',
        });
        return;
      }

      await controlService.controlPump(deviceId, action, duration);

      res.json(<ApiResponse>{
        success: true,
        message: `Pump ${action} command sent`,
      });
    } catch (error) {
      res.status(500).json(<ApiResponse>{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async controlFan(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId } = req.params;
      const { action } = req.body;

      if (action !== 'on' && action !== 'off') {
        res.status(400).json(<ApiResponse>{
          success: false,
          error: 'Invalid action. Must be "on" or "off"',
        });
        return;
      }

      await controlService.controlFan(deviceId, action);

      res.json(<ApiResponse>{
        success: true,
        message: `Fan ${action} command sent`,
      });
    } catch (error) {
      res.status(500).json(<ApiResponse>{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId } = req.params;
      const status = await controlService.getDeviceStatus(deviceId);

      if (!status) {
        res.status(404).json(<ApiResponse>{
          success: false,
          error: 'Device not found',
        });
        return;
      }

      res.json(<ApiResponse>{
        success: true,
        data: status,
      });
    } catch (error) {
      res.status(500).json(<ApiResponse>{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getAllDevices(req: Request, res: Response): Promise<void> {
    try {
      const devices = await controlService.getAllDevices();

      res.json(<ApiResponse>{
        success: true,
        data: devices,
      });
    } catch (error) {
      res.status(500).json(<ApiResponse>{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getIrrigationLogs(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await irrigationModel.getLogs(deviceId, limit);

      res.json(<ApiResponse>{
        success: true,
        data: logs,
      });
    } catch (error) {
      res.status(500).json(<ApiResponse>{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export class ScheduleController {
  async create(req: Request, res: Response): Promise<void> {
    try {
      const schedule = req.body;
      const id = await scheduleService.createSchedule(schedule);

      res.json(<ApiResponse>{
        success: true,
        data: { id },
        message: 'Schedule created successfully',
      });
    } catch (error) {
      res.status(500).json(<ApiResponse>{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getByDevice(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId } = req.params;
      const schedules = await scheduleService.getSchedules(deviceId);

      res.json(<ApiResponse>{
        success: true,
        data: schedules,
      });
    } catch (error) {
      res.status(500).json(<ApiResponse>{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;
      await scheduleService.updateSchedule(parseInt(id), updates);

      res.json(<ApiResponse>{
        success: true,
        message: 'Schedule updated successfully',
      });
    } catch (error) {
      res.status(500).json(<ApiResponse>{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await scheduleService.deleteSchedule(parseInt(id));

      res.json(<ApiResponse>{
        success: true,
        message: 'Schedule deleted successfully',
      });
    } catch (error) {
      res.status(500).json(<ApiResponse>{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const controlController = new ControlController();
export const scheduleController = new ScheduleController();
