export interface SensorReading {
  id?: number;
  deviceId: string;
  sensorType: 'soil_moisture_1' | 'soil_moisture_2' | 'temperature' | 'humidity';
  value: number;
  unit: string;
  timestamp: Date;
}

export interface DeviceStatus {
  deviceId: string;
  pumpActive: boolean;
  fanActive: boolean;
  lastSeen: Date;
  online: boolean;
}

export interface IrrigationLog {
  id?: number;
  deviceId: string;
  duration: number; // milliseconds
  triggerReason: 'manual' | 'auto' | 'schedule';
  soilMoistureBefore: number;
  soilMoistureAfter?: number;
  timestamp: Date;
}

export interface IrrigationSchedule {
  id?: number;
  deviceId: string;
  name: string;
  time: string; // HH:MM format
  daysOfWeek: number[]; // 0-6, 0 = Sunday
  duration: number; // seconds
  enabled: boolean;
}

export interface AlertThreshold {
  sensorType: string;
  min: number;
  max: number;
  enabled: boolean;
}

export interface CurrentSensorData {
  soilMoisture1: number;
  soilMoisture2: number;
  temperature: number;
  humidity: number;
  timestamp: number;
  deviceId: string;
}

export interface ControlCommand {
  device: 'pump' | 'fan';
  action: 'on' | 'off';
  duration?: number; // for auto-off
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Export cost types
export type { CostItem, CostCategoryConfig, CostSummary, BudgetConfig } from './cost.js';
