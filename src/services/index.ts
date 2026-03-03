import { mqttService } from '../config/mqtt.js';
import { sensorModel, deviceModel, irrigationModel, scheduleModel } from '../models/index.js';
import { CurrentSensorData, IrrigationLog } from '../types/index.js';
import { logger } from '../utils/logger.js';

// Default threshold values
const DEFAULT_THRESHOLDS = {
  soilMoistureMin: parseInt(process.env.SOIL_MOISTURE_MIN || '30'),
  soilMoistureMax: parseInt(process.env.SOIL_MOISTURE_MAX || '80'),
  temperatureMin: parseInt(process.env.TEMPERATURE_MIN || '15'),
  temperatureMax: parseInt(process.env.TEMPERATURE_MAX || '35'),
  humidityMin: parseInt(process.env.HUMIDITY_MIN || '40'),
  humidityMax: parseInt(process.env.HUMIDITY_MAX || '85'),
  maxIrrigationDuration: parseInt(process.env.MAX_IRRIGATION_DURATION || '300000'), // 5 minutes
  minIrrigationInterval: parseInt(process.env.MIN_IRRIGATION_INTERVAL || '3600000'), // 1 hour
};

// Track last irrigation time per device
const lastIrrigationTime = new Map<string, number>();

export class SensorService {
  async handleSensorData(data: CurrentSensorData): Promise<void> {
    const { deviceId, soilMoisture1, soilMoisture2, temperature, humidity, timestamp } = data;

    try {
      // Save sensor readings to database
      await this.saveReadings(deviceId, soilMoisture1, soilMoisture2, temperature, humidity);

      // Update device last seen
      await deviceModel.updateLastSeen(deviceId);

      // Check thresholds and trigger alerts/actions
      await this.checkThresholds(deviceId, soilMoisture1, soilMoisture2, temperature, humidity);
    } catch (error) {
      logger.error('Error handling sensor data:', error);
    }
  }

  private async saveReadings(
    deviceId: string,
    soilMoisture1: number,
    soilMoisture2: number,
    temperature: number,
    humidity: number
  ): Promise<void> {
    const now = new Date();

    await Promise.all([
      sensorModel.create({
        deviceId,
        sensorType: 'soil_moisture_1',
        value: soilMoisture1,
        unit: '%',
        timestamp: now,
      }),
      sensorModel.create({
        deviceId,
        sensorType: 'soil_moisture_2',
        value: soilMoisture2,
        unit: '%',
        timestamp: now,
      }),
      sensorModel.create({
        deviceId,
        sensorType: 'temperature',
        value: temperature,
        unit: '°C',
        timestamp: now,
      }),
      sensorModel.create({
        deviceId,
        sensorType: 'humidity',
        value: humidity,
        unit: '%',
        timestamp: now,
      }),
    ]);
  }

  private async checkThresholds(
    deviceId: string,
    soilMoisture1: number,
    soilMoisture2: number,
    temperature: number,
    humidity: number
  ): Promise<void> {
    const avgSoilMoisture = (soilMoisture1 + soilMoisture2) / 2;

    // Auto irrigation if soil is too dry
    if (avgSoilMoisture < DEFAULT_THRESHOLDS.soilMoistureMin) {
      await this.triggerAutoIrrigation(deviceId, avgSoilMoisture);
    }

    // Auto fan if temperature is too high
    if (temperature > DEFAULT_THRESHOLDS.temperatureMax) {
      mqttService.publishControl(deviceId, 'fan', 'on');
      logger.info(`Auto fan ON for device ${deviceId}, temp: ${temperature}°C`);
    }

    // Check for alerts
    if (humidity < DEFAULT_THRESHOLDS.humidityMin) {
      logger.warn(`Low humidity alert for ${deviceId}: ${humidity}%`);
    }
  }

  private async triggerAutoIrrigation(deviceId: string, soilMoisture: number): Promise<void> {
    const now = Date.now();
    const lastIrrigation = lastIrrigationTime.get(deviceId) || 0;

    if (now - lastIrrigation < DEFAULT_THRESHOLDS.minIrrigationInterval) {
      logger.debug(`Skipping auto irrigation for ${deviceId}, too soon since last irrigation`);
      return;
    }

    const duration = 10000; // 10 seconds default
    lastIrrigationTime.set(deviceId, now);

    // Publish control command
    mqttService.publishControl(deviceId, 'pump', 'on', duration);

    // Log the irrigation
    await irrigationModel.createLog({
      deviceId,
      duration,
      triggerReason: 'auto',
      soilMoistureBefore: soilMoisture,
      timestamp: new Date(),
    });

    logger.info(`Auto irrigation triggered for ${deviceId}, soil moisture: ${soilMoisture}%`);

    // Schedule pump off
    setTimeout(() => {
      mqttService.publishControl(deviceId, 'pump', 'off');
    }, duration);
  }

  async getCurrentData(deviceId: string): Promise<CurrentSensorData | null> {
    const readings = await sensorModel.getLatest(deviceId);

    if (readings.length === 0) return null;

    const getLatestValue = (type: string) => {
      return readings.find(r => r.sensorType === type)?.value || 0;
    };

    const latestReading = readings[0];

    return {
      deviceId,
      soilMoisture1: getLatestValue('soil_moisture_1'),
      soilMoisture2: getLatestValue('soil_moisture_2'),
      temperature: getLatestValue('temperature'),
      humidity: getLatestValue('humidity'),
      timestamp: latestReading.timestamp.getTime(),
    };
  }

  async getHistoryData(deviceId: string, hours: number = 24) {
    return await sensorModel.getHistory(deviceId, undefined, hours);
  }

  async getStats(deviceId: string, hours: number = 24) {
    return await sensorModel.getStats(deviceId, hours);
  }
}

export class ControlService {
  async controlPump(deviceId: string, action: 'on' | 'off', duration?: number): Promise<void> {
    if (action === 'on' && duration) {
      // Validate duration
      if (duration > DEFAULT_THRESHOLDS.maxIrrigationDuration) {
        throw new Error(`Duration exceeds maximum of ${DEFAULT_THRESHOLDS.maxIrrigationDuration}ms`);
      }

      // Get current soil moisture
      const currentData = await sensorService.getCurrentData(deviceId);
      const avgSoilMoisture = currentData
        ? (currentData.soilMoisture1 + currentData.soilMoisture2) / 2
        : 0;

      // Log the irrigation
      await irrigationModel.createLog({
        deviceId,
        duration,
        triggerReason: 'manual',
        soilMoistureBefore: avgSoilMoisture,
        timestamp: new Date(),
      });

      // Schedule auto-off
      setTimeout(() => {
        mqttService.publishControl(deviceId, 'pump', 'off');
        logger.info(`Manual pump OFF for ${deviceId} after ${duration}ms`);
      }, duration);
    }

    mqttService.publishControl(deviceId, 'pump', action);
    logger.info(`Manual pump ${action.toUpperCase()} for ${deviceId}`);

    // Update device status in database
    if (action === 'on') {
      await deviceModel.updateStatus(deviceId, { pumpActive: true });
    } else {
      await deviceModel.updateStatus(deviceId, { pumpActive: false });
    }
  }

  async controlFan(deviceId: string, action: 'on' | 'off'): Promise<void> {
    mqttService.publishControl(deviceId, 'fan', action);
    logger.info(`Manual fan ${action.toUpperCase()} for ${deviceId}`);

    // Update device status in database
    if (action === 'on') {
      await deviceModel.updateStatus(deviceId, { fanActive: true });
    } else {
      await deviceModel.updateStatus(deviceId, { fanActive: false });
    }
  }

  async getDeviceStatus(deviceId: string) {
    return await deviceModel.findByDeviceId(deviceId);
  }

  async getAllDevices() {
    return await deviceModel.getAll();
  }
}

export class ScheduleService {
  async createSchedule(schedule: Omit<IrrigationSchedule, 'id'>): Promise<number> {
    const id = await scheduleModel.create(schedule);
    logger.info(`Created irrigation schedule: ${schedule.name} for ${schedule.deviceId}`);
    return id;
  }

  async getSchedules(deviceId: string) {
    return await scheduleModel.getByDeviceId(deviceId);
  }

  async updateSchedule(id: number, updates: Partial<IrrigationSchedule>): Promise<number> {
    return await scheduleModel.update(id, updates);
  }

  async deleteSchedule(id: number): Promise<number> {
    return await scheduleModel.delete(id);
  }

  async getAllSchedules() {
    return await scheduleModel.getAll();
  }

  async executeDueSchedules(): Promise<void> {
    const dueSchedules = await scheduleModel.getDueSchedules();
    const now = new Date();

    for (const schedule of dueSchedules) {
      const lastIrrigation = lastIrrigationTime.get(schedule.deviceId) || 0;
      const timeSinceLastIrrigation = now.getTime() - lastIrrigation;

      if (timeSinceLastIrrigation < DEFAULT_THRESHOLDS.minIrrigationInterval) {
        logger.debug(`Skipping scheduled irrigation for ${schedule.deviceId}, too soon since last irrigation`);
        continue;
      }

      // Get current soil moisture
      const currentData = await sensorService.getCurrentData(schedule.deviceId);
      const avgSoilMoisture = currentData
        ? (currentData.soilMoisture1 + currentData.soilMoisture2) / 2
        : 0;

      // Execute irrigation
      const duration = schedule.duration * 1000; // Convert to ms
      lastIrrigationTime.set(schedule.deviceId, now.getTime());

      mqttService.publishControl(schedule.deviceId, 'pump', 'on', duration);

      await irrigationModel.createLog({
        deviceId: schedule.deviceId,
        duration,
        triggerReason: 'schedule',
        soilMoistureBefore: avgSoilMoisture,
        timestamp: now,
      });

      // Schedule pump off
      setTimeout(() => {
        mqttService.publishControl(schedule.deviceId, 'pump', 'off');
      }, duration);

      logger.info(`Executed scheduled irrigation: ${schedule.name} for ${schedule.deviceId}`);
    }
  }
}

export const sensorService = new SensorService();
export const controlService = new ControlService();
export const scheduleService = new ScheduleService();
