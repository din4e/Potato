import { database } from '../config/database.js';
import { CostItem, CostSummary, CostCategoryConfig } from '../types/cost.js';
import { logger } from '../utils/logger.js';

// In-memory storage for demo mode
const costItems: Map<number, CostItem> = new Map();
let costIdCounter = 1;

// Default category configuration
const defaultCategoryConfig: CostCategoryConfig = {
  hardware: { name: '硬件设备', unit: '个', icon: '🔧', color: '#3B82F6' },
  supplies: { name: '耗材用品', unit: '件/L/kg', icon: '🌱', color: '#10B981' },
  electricity: { name: '电费', unit: 'kWh', icon: '⚡', color: '#F59E0B' },
  water: { name: '水费', unit: 'm³', icon: '💧', color: '#06B6D4' },
  other: { name: '其他', unit: '项', icon: '📦', color: '#8B5CF6' },
};

// Category configuration storage (customizable per device)
const categoryConfigs: Map<string, CostCategoryConfig> = new Map();

// Initialize with demo data
const demoCosts: CostItem[] = [
  {
    id: 1,
    deviceId: 'potato-chamber-01',
    category: 'hardware',
    name: 'ESP32 开发板',
    quantity: 1,
    unitName: '个',
    unitPrice: 18,
    totalPrice: 18,
    purchaseDate: '2024-01-15',
    supplier: '淘宝',
  },
  {
    id: 2,
    deviceId: 'potato-chamber-01',
    category: 'hardware',
    name: 'ESP32-CAM 摄像头',
    quantity: 1,
    unitName: '个',
    unitPrice: 25,
    totalPrice: 25,
    purchaseDate: '2024-01-15',
    supplier: '淘宝',
  },
  {
    id: 3,
    deviceId: 'potato-chamber-01',
    category: 'hardware',
    name: '土壤湿度传感器',
    quantity: 2,
    unitName: '个',
    unitPrice: 4,
    totalPrice: 8,
    purchaseDate: '2024-01-15',
    supplier: '淘宝',
  },
  {
    id: 4,
    deviceId: 'potato-chamber-01',
    category: 'hardware',
    name: 'DHT22 温湿度传感器',
    quantity: 1,
    unitName: '个',
    unitPrice: 5,
    totalPrice: 5,
    purchaseDate: '2024-01-15',
    supplier: '淘宝',
  },
  {
    id: 5,
    deviceId: 'potato-chamber-01',
    category: 'hardware',
    name: '5V 继电器模块',
    quantity: 2,
    unitName: '个',
    unitPrice: 3,
    totalPrice: 6,
    purchaseDate: '2024-01-15',
    supplier: '淘宝',
  },
  {
    id: 6,
    deviceId: 'potato-chamber-01',
    category: 'hardware',
    name: '微型潜水泵',
    quantity: 1,
    unitName: '个',
    unitPrice: 12,
    totalPrice: 12,
    purchaseDate: '2024-01-15',
    supplier: '淘宝',
  },
  {
    id: 7,
    deviceId: 'potato-chamber-01',
    category: 'supplies',
    name: 'PE滴灌管套装',
    quantity: 1,
    unitName: '套',
    unitPrice: 15,
    totalPrice: 15,
    purchaseDate: '2024-01-16',
    supplier: '拼多多',
  },
  {
    id: 8,
    deviceId: 'potato-chamber-01',
    category: 'supplies',
    name: '营养土 10L',
    quantity: 2,
    unitName: '袋',
    unitPrice: 8,
    totalPrice: 16,
    purchaseDate: '2024-01-20',
    supplier: '花卉市场',
  },
  {
    id: 9,
    deviceId: 'potato-chamber-01',
    category: 'electricity',
    name: '电费估算',
    quantity: 15,
    unitName: 'kWh',
    unitPrice: 0.5,
    totalPrice: 5,
    purchaseDate: '2024-02-01',
    notes: '月度估算',
  },
];

// Initialize demo data
demoCosts.forEach(item => costItems.set(item.id!, item));
costIdCounter = demoCosts.length + 1;

export class CostModel {
  // Get category configuration for a device
  getCategoryConfig(deviceId: string): CostCategoryConfig {
    return categoryConfigs.get(deviceId) || defaultCategoryConfig;
  }

  // Update category configuration for a device
  updateCategoryConfig(deviceId: string, config: Partial<CostCategoryConfig>): CostCategoryConfig {
    const current = this.getCategoryConfig(deviceId);
    const updated = { ...current };

    if (config.hardware) updated.hardware = { ...current.hardware, ...config.hardware };
    if (config.supplies) updated.supplies = { ...current.supplies, ...config.supplies };
    if (config.electricity) updated.electricity = { ...current.electricity, ...config.electricity };
    if (config.water) updated.water = { ...current.water, ...config.water };
    if (config.other) updated.other = { ...current.other, ...config.other };

    categoryConfigs.set(deviceId, updated);
    return updated;
  }

  async getAll(deviceId: string): Promise<CostItem[]> {
    if (database.isDemoMode()) {
      return Array.from(costItems.values()).filter(item => item.deviceId === deviceId);
    }

    const sql = `
      SELECT id, device_id as deviceId, category, name, quantity, unit_name as unitName,
             unit_price as unitPrice, total_price as totalPrice,
             purchase_date as purchaseDate, supplier, notes
      FROM costs
      WHERE device_id = ?
      ORDER BY purchase_date DESC
    `;
    return await database.query<CostItem>(sql, [deviceId]);
  }

  async getById(id: number): Promise<CostItem | null> {
    if (database.isDemoMode()) {
      return costItems.get(id) || null;
    }

    const sql = `
      SELECT id, device_id as deviceId, category, name, quantity, unit_name as unitName,
             unit_price as unitPrice, total_price as totalPrice,
             purchase_date as purchaseDate, supplier, notes
      FROM costs
      WHERE id = ?
    `;
    return await database.queryOne<CostItem>(sql, [id]);
  }

  async create(cost: Omit<CostItem, 'id'>): Promise<number> {
    if (database.isDemoMode()) {
      const newItem = { ...cost, id: costIdCounter++ };
      costItems.set(newItem.id, newItem);
      logger.info(`[DEMO] Cost item created: ${newItem.name}`);
      return newItem.id;
    }

    const sql = `
      INSERT INTO costs (device_id, category, name, quantity, unit_name, unit_price, total_price, purchase_date, supplier, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    return await database.insert(sql, [
      cost.deviceId,
      cost.category,
      cost.name,
      cost.quantity,
      cost.unitName || '',
      cost.unitPrice,
      cost.totalPrice,
      cost.purchaseDate,
      cost.supplier || null,
      cost.notes || null,
    ]);
  }

  async update(id: number, cost: Partial<Omit<CostItem, 'id'>>): Promise<boolean> {
    if (database.isDemoMode()) {
      const existing = costItems.get(id);
      if (existing) {
        const updated = { ...existing, ...cost };
        costItems.set(id, updated);
        logger.info(`[DEMO] Cost item updated: ${updated.name}`);
        return true;
      }
      return false;
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (cost.name !== undefined) {
      fields.push('name = ?');
      values.push(cost.name);
    }
    if (cost.category !== undefined) {
      fields.push('category = ?');
      values.push(cost.category);
    }
    if (cost.quantity !== undefined) {
      fields.push('quantity = ?');
      values.push(cost.quantity);
    }
    if (cost.unitName !== undefined) {
      fields.push('unit_name = ?');
      values.push(cost.unitName);
    }
    if (cost.unitPrice !== undefined) {
      fields.push('unit_price = ?');
      values.push(cost.unitPrice);
    }
    if (cost.totalPrice !== undefined) {
      fields.push('total_price = ?');
      values.push(cost.totalPrice);
    }
    if (cost.purchaseDate !== undefined) {
      fields.push('purchase_date = ?');
      values.push(cost.purchaseDate);
    }
    if (cost.supplier !== undefined) {
      fields.push('supplier = ?');
      values.push(cost.supplier);
    }
    if (cost.notes !== undefined) {
      fields.push('notes = ?');
      values.push(cost.notes);
    }

    values.push(id);

    const sql = `
      UPDATE costs
      SET ${fields.join(', ')}
      WHERE id = ?
    `;
    const affected = await database.update(sql, values);
    return affected > 0;
  }

  async delete(id: number): Promise<boolean> {
    if (database.isDemoMode()) {
      const deleted = costItems.delete(id);
      if (deleted) {
        logger.info(`[DEMO] Cost item deleted: ${id}`);
      }
      return deleted;
    }

    const sql = 'DELETE FROM costs WHERE id = ?';
    const affected = await database.delete(sql, [id]);
    return affected > 0;
  }

  async getSummary(deviceId: string): Promise<CostSummary> {
    const items = await this.getAll(deviceId);

    const categoryBreakdown: Record<string, number> = {
      hardware: 0,
      supplies: 0,
      electricity: 0,
      water: 0,
      other: 0,
    };

    let totalCost = 0;
    let monthlyOperating = 0;

    for (const item of items) {
      totalCost += item.totalPrice;

      if (categoryBreakdown[item.category] !== undefined) {
        categoryBreakdown[item.category] += item.totalPrice;
      }

      if (item.category === 'electricity' || item.category === 'water') {
        monthlyOperating += item.totalPrice;
      }
    }

    return {
      totalCost,
      categoryBreakdown,
      monthlyOperating,
      projectedAnnual: monthlyOperating * 12,
    };
  }

  async initSchema(): Promise<void> {
    if (database.isDemoMode()) {
      return;
    }

    const sql = `
      CREATE TABLE IF NOT EXISTS costs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(100) NOT NULL,
        category ENUM('hardware', 'supplies', 'electricity', 'water', 'other') NOT NULL,
        name VARCHAR(255) NOT NULL,
        quantity DECIMAL(10, 2) NOT NULL,
        unit_name VARCHAR(50) NOT NULL DEFAULT '',
        unit_price DECIMAL(10, 2) NOT NULL,
        total_price DECIMAL(10, 2) NOT NULL,
        purchase_date DATE NOT NULL,
        supplier VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_device_category (device_id, category),
        INDEX idx_purchase_date (purchase_date)
      )
    `;
    await database.query(sql);
  }
}

export const costModel = new CostModel();
