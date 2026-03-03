import { Request, Response } from 'express';
import { costModel } from '../models/costModel.js';
import { ApiResponse, CostCategoryConfig } from '../types/index.js';

export class CostController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId } = req.params;
      const costs = await costModel.getAll(deviceId);

      res.json(<ApiResponse>{
        success: true,
        data: costs,
      });
    } catch (error) {
      res.status(500).json(<ApiResponse>{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getSummary(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId } = req.params;
      const summary = await costModel.getSummary(deviceId);

      res.json(<ApiResponse>{
        success: true,
        data: summary,
      });
    } catch (error) {
      res.status(500).json(<ApiResponse>{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getCategoryConfig(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId } = req.params;
      const config = costModel.getCategoryConfig(deviceId);

      res.json(<ApiResponse>{
        success: true,
        data: config,
      });
    } catch (error) {
      res.status(500).json(<ApiResponse>{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async updateCategoryConfig(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId } = req.params;
      const config = req.body as Partial<CostCategoryConfig>;

      const updated = costModel.updateCategoryConfig(deviceId, config);

      res.json(<ApiResponse>{
        success: true,
        data: updated,
        message: '分类配置更新成功',
      });
    } catch (error) {
      res.status(500).json(<ApiResponse>{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const cost = req.body;

      // Calculate total price if not provided
      if (!cost.totalPrice) {
        cost.totalPrice = cost.quantity * cost.unitPrice;
      }

      const id = await costModel.create(cost);

      res.json(<ApiResponse>{
        success: true,
        data: { id },
        message: '成本记录添加成功',
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

      // Recalculate total price if quantity or unit_price changed
      if (updates.quantity !== undefined || updates.unitPrice !== undefined) {
        const existing = await costModel.getById(parseInt(id));
        if (existing) {
          const qty = updates.quantity ?? existing.quantity;
          const price = updates.unitPrice ?? existing.unitPrice;
          updates.totalPrice = qty * price;
        }
      }

      const success = await costModel.update(parseInt(id), updates);

      res.json(<ApiResponse>{
        success: success,
        message: success ? '成本记录更新成功' : '记录不存在',
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
      const success = await costModel.delete(parseInt(id));

      res.json(<ApiResponse>{
        success: success,
        message: success ? '成本记录删除成功' : '记录不存在',
      });
    } catch (error) {
      res.status(500).json(<ApiResponse>{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const costController = new CostController();
