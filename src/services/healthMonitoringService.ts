import { deviceModel, sensorModel, irrigationModel } from '../models/index.js';
import { notificationService } from './notificationService.js';
import { logger } from '../utils/logger.js';

interface DeviceHealthStatus {
  deviceId: string;
  online: boolean;
  lastSeen: Date;
  offlineDuration: number;
  isOffline: boolean;
  wasOffline: boolean; // Previously offline but now online
}

interface ThresholdConfig {
  soilMoisture: { min: number; max: number };
  temperature: { min: number; max: number };
  humidity: { min: number; max: number };
}

export class HealthMonitoringService {
  private devicesStatus: Map<string, DeviceHealthStatus> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private offlineThreshold: number; // milliseconds before alerting
  private thresholds: ThresholdConfig;
  private lastAlertTimes: Map<string, number> = new Map();
  private alertCooldown: number = 30 * 60 * 1000; // 30 minutes between same alerts

  constructor() {
    this.offlineThreshold = parseInt(process.env.OFFLINE_THRESHOLD || '300000'); // 5 minutes default
    this.thresholds = {
      soilMoisture: {
        min: parseInt(process.env.SOIL_MOISTURE_MIN || '30'),
        max: parseInt(process.env.SOIL_MOISTURE_MAX || '80'),
      },
      temperature: {
        min: parseInt(process.env.TEMPERATURE_MIN || '15'),
        max: parseInt(process.env.TEMPERATURE_MAX || '35'),
      },
      humidity: {
        min: parseInt(process.env.HUMIDITY_MIN || '40'),
        max: parseInt(process.env.HUMIDITY_MAX || '85'),
      },
    };
  }

  // Start health monitoring
  start(checkIntervalMs: number = 60000): void {
    logger.info(`Starting health monitoring service (check interval: ${checkIntervalMs}ms)`);

    // Initial check
    this.checkAllDevices();

    // Periodic checks
    this.checkInterval = setInterval(() => {
      this.checkAllDevices();
    }, checkIntervalMs);
  }

  // Stop health monitoring
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('Health monitoring service stopped');
    }
  }

  // Check all devices
  private async checkAllDevices(): Promise<void> {
    try {
      const devices = await deviceModel.getAll();

      for (const device of devices) {
        await this.checkDeviceHealth(device.deviceId, device.online || false, device.lastSeen || new Date());
      }
    } catch (error) {
      logger.error('Error checking device health:', error);
    }
  }

  // Check single device health
  async checkDeviceHealth(deviceId: string, online: boolean, lastSeen: Date): Promise<void> {
    const now = Date.now();
    const lastSeenTime = lastSeen instanceof Date ? lastSeen.getTime() : new Date(lastSeen).getTime();
    const offlineDuration = now - lastSeenTime;
    const isOffline = offlineDuration > this.offlineThreshold;

    const previousStatus = this.devicesStatus.get(deviceId);
    const wasOffline = previousStatus?.isOffline || false;

    const currentStatus: DeviceHealthStatus = {
      deviceId,
      online,
      lastSeen,
      offlineDuration,
      isOffline,
      wasOffline: wasOffline && !isOffline, // Was offline, now online
    };

    // Handle offline detection
    if (isOffline && !wasOffline) {
      await this.handleOffline(deviceId, offlineDuration);
    }

    // Handle recovery
    if (!isOffline && wasOffline) {
      await this.handleRecovery(deviceId, offlineDuration);
    }

    // Check thresholds if device is online
    if (!isOffline) {
      await this.checkThresholds(deviceId);
    }

    this.devicesStatus.set(deviceId, currentStatus);
  }

  // Handle offline device
  private async handleOffline(deviceId: string, offlineDuration: number): Promise<void> {
    logger.warn(`Device ${deviceId} is offline for ${offlineDuration}ms`);

    const alertKey = `${deviceId}:offline`;
    const lastAlert = this.lastAlertTimes.get(alertKey) || 0;

    // Only alert if cooldown period has passed
    if (Date.now() - lastAlert > this.alertCooldown) {
      const device = await deviceModel.findByDeviceId(deviceId);
      const deviceName = device?.name || deviceId;

      await notificationService.sendOfflineAlert(deviceName, offlineDuration);
      this.lastAlertTimes.set(alertKey, Date.now());

      // Update device status in database
      await deviceModel.setOffline(deviceId);
    }
  }

  // Handle recovered device
  private async handleRecovery(deviceId: string, offlineDuration: number): Promise<void> {
    logger.info(`Device ${deviceId} recovered after ${offlineDuration}ms offline`);

    const device = await deviceModel.findByDeviceId(deviceId);
    const deviceName = device?.name || deviceId;

    await notificationService.sendRecoveryNotice(deviceName, offlineDuration);
    this.lastAlertTimes.delete(`${deviceId}:offline`);
  }

  // Check sensor thresholds
  private async checkThresholds(deviceId: string): Promise<void> {
    try {
      const readings = await sensorModel.getLatest(deviceId);

      if (!readings || readings.length === 0) {
        return;
      }

      const device = await deviceModel.findByDeviceId(deviceId);
      const deviceName = device?.name || deviceId;

      // Get latest values by sensor type
      const latestValues = new Map<string, number>();
      for (const reading of readings) {
        latestValues.set(reading.sensorType, reading.value);
      }

      // Check each threshold
      const checks = [
        {
          type: 'soil_moisture_1' as const,
          value: latestValues.get('soil_moisture_1'),
          label: '土壤湿度1',
        },
        {
          type: 'soil_moisture_2' as const,
          value: latestValues.get('soil_moisture_2'),
          label: '土壤湿度2',
        },
        {
          type: 'temperature' as const,
          value: latestValues.get('temperature'),
          label: '温度',
        },
        {
          type: 'humidity' as const,
          value: latestValues.get('humidity'),
          label: '空气湿度',
        },
      ];

      for (const check of checks) {
        if (check.value === undefined) continue;

        // Soil moisture checks
        if (check.type.startsWith('soil_moisture')) {
          if (check.value < this.thresholds.soilMoisture.min) {
            await this.handleThresholdAlert(
              deviceId,
              deviceName,
              check.label,
              check.value,
              this.thresholds.soilMoisture.min,
              'low'
            );
          } else if (check.value > this.thresholds.soilMoisture.max) {
            await this.handleThresholdAlert(
              deviceId,
              deviceName,
              check.label,
              check.value,
              this.thresholds.soilMoisture.max,
              'high'
            );
          }
        }

        // Temperature checks
        if (check.type === 'temperature') {
          if (check.value < this.thresholds.temperature.min) {
            await this.handleThresholdAlert(
              deviceId,
              deviceName,
              check.label,
              check.value,
              this.thresholds.temperature.min,
              'low'
            );
          } else if (check.value > this.thresholds.temperature.max) {
            await this.handleThresholdAlert(
              deviceId,
              deviceName,
              check.label,
              check.value,
              this.thresholds.temperature.max,
              'high'
            );
          }
        }

        // Humidity checks
        if (check.type === 'humidity') {
          if (check.value < this.thresholds.humidity.min) {
            await this.handleThresholdAlert(
              deviceId,
              deviceName,
              check.label,
              check.value,
              this.thresholds.humidity.min,
              'low'
            );
          } else if (check.value > this.thresholds.humidity.max) {
            await this.handleThresholdAlert(
              deviceId,
              deviceName,
              check.label,
              check.value,
              this.thresholds.humidity.max,
              'high'
            );
          }
        }
      }
    } catch (error) {
      logger.error(`Error checking thresholds for device ${deviceId}:`, error);
    }
  }

  // Handle threshold alert
  private async handleThresholdAlert(
    deviceId: string,
    deviceName: string,
    sensorType: string,
    currentValue: number,
    threshold: number,
    type: 'high' | 'low'
  ): Promise<void> {
    const alertKey = `${deviceId}:${sensorType}:${type}`;
    const lastAlert = this.lastAlertTimes.get(alertKey) || 0;

    // Only alert if cooldown period has passed
    if (Date.now() - lastAlert > this.alertCooldown) {
      logger.warn(
        `Threshold alert for ${deviceName}: ${sensorType} is ${type} (${currentValue} vs ${threshold})`
      );

      await notificationService.sendThresholdAlert(
        type,
        sensorType,
        currentValue,
        threshold,
        deviceName
      );

      this.lastAlertTimes.set(alertKey, Date.now());
    }
  }

  // Get current health status of all devices
  getHealthStatus(): Map<string, DeviceHealthStatus> {
    return this.devicesStatus;
  }

  // Get health status for a specific device
  getDeviceHealth(deviceId: string): DeviceHealthStatus | undefined {
    return this.devicesStatus.get(deviceId);
  }

  // Update thresholds
  updateThresholds(newThresholds: Partial<ThresholdConfig>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    logger.info('Thresholds updated:', this.thresholds);
  }

  // Test alert (for configuration verification)
  async testAlert(deviceId: string): Promise<boolean> {
    const device = await deviceModel.findByDeviceId(deviceId);
    const deviceName = device?.name || deviceId;

    await notificationService.sendThresholdAlert(
      'low',
      '土壤湿度',
      25,
      30,
      deviceName
    );

    return true;
  }
}

export const healthMonitoringService = new HealthMonitoringService();
