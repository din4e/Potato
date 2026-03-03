import { database } from '../config/database.js';
import { SensorReading, DeviceStatus, IrrigationLog, IrrigationSchedule } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class SensorModel {
  async create(reading: SensorReading): Promise<number> {
    const sql = `
      INSERT INTO sensor_readings (device_id, sensor_type, value, unit, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `;
    return await database.insert(sql, [
      reading.deviceId,
      reading.sensorType,
      reading.value,
      reading.unit,
      reading.timestamp,
    ]);
  }

  async getLatest(deviceId: string): Promise<SensorReading[]> {
    const sql = `
      SELECT * FROM sensor_readings
      WHERE device_id = ?
      ORDER BY timestamp DESC
      LIMIT 20
    `;
    return await database.query<SensorReading>(sql, [deviceId]);
  }

  async getLatestByType(deviceId: string, sensorType: string): Promise<SensorReading | null> {
    const sql = `
      SELECT * FROM sensor_readings
      WHERE device_id = ? AND sensor_type = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `;
    return await database.queryOne<SensorReading>(sql, [deviceId, sensorType]);
  }

  async getHistory(
    deviceId: string,
    sensorType?: string,
    hours: number = 24
  ): Promise<SensorReading[]> {
    const sql = sensorType
      ? `
      SELECT * FROM sensor_readings
      WHERE device_id = ? AND sensor_type = ? AND timestamp >= DATE_SUB(NOW(), INTERVAL ? HOUR)
      ORDER BY timestamp ASC
    `
      : `
      SELECT * FROM sensor_readings
      WHERE device_id = ? AND timestamp >= DATE_SUB(NOW(), INTERVAL ? HOUR)
      ORDER BY timestamp ASC
    `;
    const params = sensorType
      ? [deviceId, sensorType, hours]
      : [deviceId, hours];
    return await database.query<SensorReading>(sql, params);
  }

  async getStats(deviceId: string, hours: number = 24) {
    const sql = `
      SELECT
        sensor_type,
        AVG(value) as avg_value,
        MIN(value) as min_value,
        MAX(value) as max_value,
        COUNT(*) as count
      FROM sensor_readings
      WHERE device_id = ? AND timestamp >= DATE_SUB(NOW(), INTERVAL ? HOUR)
      GROUP BY sensor_type
    `;
    return await database.query(sql, [deviceId, hours]);
  }

  async cleanup(daysToKeep: number = 30): Promise<number> {
    const sql = `
      DELETE FROM sensor_readings
      WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)
    `;
    return await database.delete(sql, [daysToKeep]);
  }
}

export class DeviceModel {
  async create(device: Omit<DeviceStatus, 'lastSeen'> & { name: string; location?: string }): Promise<number> {
    const sql = `
      INSERT INTO devices (device_id, name, location, pump_active, fan_active, online, last_seen)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;
    return await database.insert(sql, [
      device.deviceId,
      device.name,
      device.location || null,
      device.pumpActive,
      device.fanActive,
      device.online,
    ]);
  }

  async findByDeviceId(deviceId: string): Promise<DeviceStatus & { name: string; location?: string } | null> {
    const sql = `
      SELECT device_id as deviceId, name, location, pump_active as pumpActive,
             fan_active as fanActive, online, last_seen as lastSeen
      FROM devices
      WHERE device_id = ?
    `;
    return await database.queryOne<any>(sql, [deviceId]);
  }

  async getAll(): Promise<DeviceStatus[]> {
    const sql = `
      SELECT device_id as deviceId, name, location, pump_active as pumpActive,
             fan_active as fanActive, online, last_seen as lastSeen
      FROM devices
      ORDER BY created_at ASC
    `;
    return await database.query<DeviceStatus>(sql);
  }

  async updateStatus(deviceId: string, updates: Partial<DeviceStatus>): Promise<number> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.pumpActive !== undefined) {
      fields.push('pump_active = ?');
      values.push(updates.pumpActive);
    }
    if (updates.fanActive !== undefined) {
      fields.push('fan_active = ?');
      values.push(updates.fanActive);
    }
    if (updates.online !== undefined) {
      fields.push('online = ?');
      values.push(updates.online);
    }

    if (fields.length === 0) return 0;

    fields.push('last_seen = NOW()');
    values.push(deviceId);

    const sql = `
      UPDATE devices
      SET ${fields.join(', ')}
      WHERE device_id = ?
    `;
    return await database.update(sql, values);
  }

  async updateLastSeen(deviceId: string): Promise<number> {
    const sql = `
      UPDATE devices
      SET last_seen = NOW(), online = TRUE
      WHERE device_id = ?
    `;
    return await database.update(sql, [deviceId]);
  }

  async setOffline(deviceId: string): Promise<number> {
    const sql = `
      UPDATE devices
      SET online = FALSE
      WHERE device_id = ?
    `;
    return await database.update(sql, [deviceId]);
  }
}

export class IrrigationModel {
  async createLog(log: Omit<IrrigationLog, 'id'>): Promise<number> {
    const sql = `
      INSERT INTO irrigation_logs (device_id, duration, trigger_reason, soil_moisture_before, soil_moisture_after)
      VALUES (?, ?, ?, ?, ?)
    `;
    return await database.insert(sql, [
      log.deviceId,
      log.duration,
      log.triggerReason,
      log.soilMoistureBefore,
      log.soilMoistureAfter || null,
    ]);
  }

  async getLogs(deviceId: string, limit: number = 50): Promise<IrrigationLog[]> {
    const sql = `
      SELECT id, device_id as deviceId, duration, trigger_reason as triggerReason,
             soil_moisture_before as soilMoistureBefore, soil_moisture_after as soilMoistureAfter,
             timestamp
      FROM irrigation_logs
      WHERE device_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `;
    return await database.query<IrrigationLog>(sql, [deviceId, limit]);
  }

  async getStats(deviceId: string, days: number = 7) {
    const sql = `
      SELECT
        COUNT(*) as total_irrigations,
        SUM(duration) / 1000 as total_duration_seconds,
        AVG(duration) / 1000 as avg_duration_seconds,
        trigger_reason as triggerReason
      FROM irrigation_logs
      WHERE device_id = ? AND timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY trigger_reason
    `;
    return await database.query(sql, [deviceId, days]);
  }
}

export class ScheduleModel {
  async create(schedule: Omit<IrrigationSchedule, 'id'>): Promise<number> {
    const sql = `
      INSERT INTO irrigation_schedules (device_id, name, time, days_of_week, duration, enabled)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    return await database.insert(sql, [
      schedule.deviceId,
      schedule.name,
      schedule.time,
      schedule.daysOfWeek.join(','),
      schedule.duration,
      schedule.enabled,
    ]);
  }

  async getByDeviceId(deviceId: string): Promise<IrrigationSchedule[]> {
    const sql = `
      SELECT id, device_id as deviceId, name, time, days_of_week as daysOfWeek,
             duration, enabled, created_at as createdAt
      FROM irrigation_schedules
      WHERE device_id = ?
      ORDER BY time ASC
    `;
    const schedules = await database.query<any>(sql, [deviceId]);
    return schedules.map((s: any) => ({
      ...s,
      daysOfWeek: s.daysOfWeek.split(',').map((d: string) => parseInt(d)),
    }));
  }

  async getAll(): Promise<IrrigationSchedule[]> {
    const sql = `
      SELECT id, device_id as deviceId, name, time, days_of_week as daysOfWeek,
             duration, enabled, created_at as createdAt
      FROM irrigation_schedules
      WHERE enabled = TRUE
      ORDER BY time ASC
    `;
    const schedules = await database.query<any>(sql);
    return schedules.map((s: any) => ({
      ...s,
      daysOfWeek: s.daysOfWeek.split(',').map((d: string) => parseInt(d)),
    }));
  }

  async update(id: number, updates: Partial<Omit<IrrigationSchedule, 'id' | 'deviceId'>>): Promise<number> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.time !== undefined) {
      fields.push('time = ?');
      values.push(updates.time);
    }
    if (updates.daysOfWeek !== undefined) {
      fields.push('days_of_week = ?');
      values.push(updates.daysOfWeek.join(','));
    }
    if (updates.duration !== undefined) {
      fields.push('duration = ?');
      values.push(updates.duration);
    }
    if (updates.enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(updates.enabled);
    }

    values.push(id);

    const sql = `
      UPDATE irrigation_schedules
      SET ${fields.join(', ')}
      WHERE id = ?
    `;
    return await database.update(sql, values);
  }

  async delete(id: number): Promise<number> {
    const sql = 'DELETE FROM irrigation_schedules WHERE id = ?';
    return await database.delete(sql, [id]);
  }

  async getDueSchedules(): Promise<IrrigationSchedule[]> {
    const currentTime = new Date().toTimeString().slice(0, 5);
    const currentDay = new Date().getDay();

    const sql = `
      SELECT id, device_id as deviceId, name, time, days_of_week as daysOfWeek,
             duration, enabled, created_at as createdAt
      FROM irrigation_schedules
      WHERE enabled = TRUE
        AND time <= ?
        AND FIND_IN_SET(?, days_of_week) > 0
      ORDER BY time ASC
    `;
    const schedules = await database.query<any>(sql, [currentTime, currentDay]);
    return schedules.map((s: any) => ({
      ...s,
      daysOfWeek: s.daysOfWeek.split(',').map((d: string) => parseInt(d)),
    }));
  }
}

export const sensorModel = new SensorModel();
export const deviceModel = new DeviceModel();
export const irrigationModel = new IrrigationModel();
export const scheduleModel = new ScheduleModel();
