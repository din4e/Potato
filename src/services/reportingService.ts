import cron from 'node-cron';
import { deviceModel, sensorModel, irrigationModel } from '../models/index.js';
import { notificationService, CultivationReportData } from './notificationService.js';
import { logger } from '../utils/logger.js';

interface ReportSchedule {
  deviceId: string;
  period: 'daily' | 'weekly';
  hour: number; // 0-23
  minute?: number; // 0-59
  dayOfWeek?: number; // 0-6 for weekly (0 = Sunday)
  enabled: boolean;
}

interface StoredSchedule extends ReportSchedule {
  id: number;
}

export class ReportingService {
  private schedules: Map<string, ReportSchedule> = new Map();
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();

  constructor() {
    // Initialize with default schedules
    this.initializeDefaultSchedules();
  }

  // Initialize default schedules
  private initializeDefaultSchedules(): void {
    // Daily report at 8:00 AM
    this.addSchedule({
      deviceId: 'all',
      period: 'daily',
      hour: 8,
      minute: 0,
      enabled: true,
    });

    // Weekly report on Sunday at 9:00 AM
    this.addSchedule({
      deviceId: 'all',
      period: 'weekly',
      hour: 9,
      minute: 0,
      dayOfWeek: 0,
      enabled: true,
    });

    logger.info('Default report schedules initialized');
  }

  // Add a new report schedule
  addSchedule(schedule: ReportSchedule): void {
    const key = this.getScheduleKey(schedule);
    this.schedules.set(key, schedule);
    this.scheduleCronJob(schedule);
    logger.info(`Report schedule added: ${key}`);
  }

  // Remove a report schedule
  removeSchedule(deviceId: string, period: 'daily' | 'weekly'): void {
    const key = `${deviceId}:${period}`;
    const job = this.cronJobs.get(key);
    if (job) {
      job.stop();
      this.cronJobs.delete(key);
    }
    this.schedules.delete(key);
    logger.info(`Report schedule removed: ${key}`);
  }

  // Get schedule key
  private getScheduleKey(schedule: ReportSchedule): string {
    return `${schedule.deviceId}:${schedule.period}`;
  }

  // Schedule a cron job for report generation
  private scheduleCronJob(schedule: ReportSchedule): void {
    const key = this.getScheduleKey(schedule);

    // Stop existing job if any
    const existingJob = this.cronJobs.get(key);
    if (existingJob) {
      existingJob.stop();
    }

    // Build cron expression
    let cronExpression: string;

    if (schedule.period === 'daily') {
      const minute = schedule.minute ?? 0;
      const hour = schedule.hour;
      cronExpression = `${minute} ${hour} * * *`;
    } else {
      // Weekly
      const minute = schedule.minute ?? 0;
      const hour = schedule.hour;
      const dayOfWeek = schedule.dayOfWeek ?? 0;
      cronExpression = `${minute} ${hour} * * ${dayOfWeek}`;
    }

    // Create and start the cron job
    const job = cron.schedule(cronExpression, async () => {
      if (schedule.enabled) {
        await this.generateAndSendReport(schedule);
      }
    });

    this.cronJobs.set(key, job);
    logger.info(`Cron job scheduled: ${cronExpression} for ${key}`);
  }

  // Generate and send report
  async generateAndSendReport(schedule: ReportSchedule): Promise<void> {
    try {
      logger.info(`Generating ${schedule.period} report for ${schedule.deviceId}`);

      // Get devices to report on
      const devices = schedule.deviceId === 'all'
        ? await deviceModel.getAll()
        : [await deviceModel.findByDeviceId(schedule.deviceId)].filter(Boolean);

      // Generate report for each device
      for (const device of devices) {
        const reportData = await this.generateReportData(device.deviceId, schedule.period);
        await notificationService.sendCultivationReport(reportData, schedule.period);
      }

      logger.info(`${schedule.period} report sent successfully`);
    } catch (error) {
      logger.error(`Error generating ${schedule.period} report:`, error);
    }
  }

  // Generate report data for a device
  async generateReportData(deviceId: string, period: 'daily' | 'weekly'): Promise<CultivationReportData> {
    const now = new Date();
    const hours = period === 'daily' ? 24 : 24 * 7;
    const startDate = new Date(now.getTime() - hours * 60 * 60 * 1000);

    // Get device info
    const device = await deviceModel.findByDeviceId(deviceId);
    const deviceName = device?.name || deviceId;

    // Get current sensor data
    const latestReadings = await sensorModel.getLatest(deviceId);
    const current = this.extractCurrentData(latestReadings);

    // Get historical stats
    const history = await sensorModel.getHistory(deviceId, undefined, hours);
    const stats = this.calculateStats(history);

    // Get irrigation logs
    const irrigationLogs = await irrigationModel.getLogs(deviceId, 100);
    const periodIrrigations = irrigationLogs.filter(log => {
      const logTime = new Date(log.timestamp).getTime();
      return logTime >= startDate.getTime();
    });

    // Generate suggestions
    const suggestions = this.generateSuggestions(current, stats, periodIrrigations);

    // Format report period
    const reportPeriod = this.formatReportPeriod(startDate, now, period);

    return {
      reportPeriod,
      deviceName,
      current,
      stats,
      irrigations: periodIrrigations.map(irr => ({
        timestamp: new Date(irr.timestamp).getTime(),
        duration: irr.duration,
        reason: irr.triggerReason,
        soilMoistureBefore: irr.soilMoistureBefore || 0,
        soilMoistureAfter: irr.soilMoistureAfter || undefined,
      })),
      suggestions,
    };
  }

  // Extract current sensor data
  private extractCurrentData(readings: any[]): {
    soilMoisture: number;
    temperature: number;
    humidity: number;
    timestamp: number;
  } {
    const values = {
      soilMoisture: 0,
      temperature: 0,
      humidity: 0,
      timestamp: Date.now(),
    };

    const soilMoistureValues: number[] = [];

    for (const reading of readings) {
      switch (reading.sensorType) {
        case 'soil_moisture_1':
        case 'soil_moisture_2':
          soilMoistureValues.push(reading.value);
          break;
        case 'temperature':
          values.temperature = reading.value;
          break;
        case 'humidity':
          values.humidity = reading.value;
          break;
      }
      if (reading.timestamp) {
        values.timestamp = new Date(reading.timestamp).getTime();
      }
    }

    // Average soil moisture from both sensors
    if (soilMoistureValues.length > 0) {
      values.soilMoisture =
        soilMoistureValues.reduce((sum, val) => sum + val, 0) / soilMoistureValues.length;
    }

    return values;
  }

  // Calculate statistics from historical data
  private calculateStats(readings: any[]): {
    avgSoilMoisture: number;
    avgTemperature: number;
    avgHumidity: number;
    minTemperature: number;
    maxTemperature: number;
    minHumidity: number;
    maxHumidity: number;
  } {
    const stats = {
      avgSoilMoisture: 0,
      avgTemperature: 0,
      avgHumidity: 0,
      minTemperature: Infinity,
      maxTemperature: -Infinity,
      minHumidity: Infinity,
      maxHumidity: -Infinity,
    };

    const soilMoistureValues: number[] = [];
    const temperatureValues: number[] = [];
    const humidityValues: number[] = [];

    for (const reading of readings) {
      switch (reading.sensorType) {
        case 'soil_moisture_1':
        case 'soil_moisture_2':
          soilMoistureValues.push(reading.value);
          break;
        case 'temperature':
          temperatureValues.push(reading.value);
          stats.minTemperature = Math.min(stats.minTemperature, reading.value);
          stats.maxTemperature = Math.max(stats.maxTemperature, reading.value);
          break;
        case 'humidity':
          humidityValues.push(reading.value);
          stats.minHumidity = Math.min(stats.minHumidity, reading.value);
          stats.maxHumidity = Math.max(stats.maxHumidity, reading.value);
          break;
      }
    }

    if (soilMoistureValues.length > 0) {
      stats.avgSoilMoisture =
        soilMoistureValues.reduce((sum, val) => sum + val, 0) / soilMoistureValues.length;
    }

    if (temperatureValues.length > 0) {
      stats.avgTemperature =
        temperatureValues.reduce((sum, val) => sum + val, 0) / temperatureValues.length;
    }

    if (humidityValues.length > 0) {
      stats.avgHumidity =
        humidityValues.reduce((sum, val) => sum + val, 0) / humidityValues.length;
    }

    // Handle empty data
    if (stats.minTemperature === Infinity) stats.minTemperature = 0;
    if (stats.maxTemperature === -Infinity) stats.maxTemperature = 0;
    if (stats.minHumidity === Infinity) stats.minHumidity = 0;
    if (stats.maxHumidity === -Infinity) stats.maxHumidity = 0;

    return stats;
  }

  // Generate suggestions based on data
  private generateSuggestions(
    current: any,
    stats: any,
    irrigations: any[]
  ): string[] {
    const suggestions: string[] = [];

    // Soil moisture suggestions
    if (current.soilMoisture < 30) {
      suggestions.push('土壤湿度偏低，建议增加浇水频率或延长浇水时间');
    } else if (current.soilMoisture > 80) {
      suggestions.push('土壤湿度偏高，建议减少浇水频率，注意排水');
    }

    // Temperature suggestions
    if (current.temperature < 15) {
      suggestions.push('温度偏低，建议开启加热设备或将培育箱移至温暖处');
    } else if (current.temperature > 35) {
      suggestions.push('温度偏高，建议开启风扇散热或移至阴凉处');
    }

    // Humidity suggestions
    if (current.humidity < 40) {
      suggestions.push('空气湿度偏低，建议适当喷水增加湿度');
    } else if (current.humidity > 85) {
      suggestions.push('空气湿度偏高，注意通风，防止霉菌生长');
    }

    // Irrigation analysis
    const autoIrrigations = irrigations.filter((i) => i.triggerReason === 'auto').length;
    if (autoIrrigations > 3) {
      suggestions.push('自动浇水次数较多，建议检查土壤保水性和滴灌系统');
    }

    if (irrigations.length === 0) {
      suggestions.push('近期无浇水记录，请确认植物需水情况');
    }

    // General suggestions based on stats
    if (stats.maxTemperature - stats.minTemperature > 15) {
      suggestions.push('温度波动较大，建议改善培育箱保温措施');
    }

    return suggestions;
  }

  // Format report period text
  private formatReportPeriod(startDate: Date, endDate: Date, period: 'daily' | 'weekly'): string {
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    };

    const formatTime = (date: Date) => {
      return date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    if (period === 'daily') {
      return `${formatDate(startDate)} ${formatTime(startDate)} - ${formatTime(endDate)}`;
    } else {
      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    }
  }

  // Get all schedules
  getSchedules(): ReportSchedule[] {
    return Array.from(this.schedules.values());
  }

  // Update a schedule
  updateSchedule(deviceId: string, period: 'daily' | 'weekly', updates: Partial<ReportSchedule>): void {
    const key = `${deviceId}:${period}`;
    const existing = this.schedules.get(key);

    if (existing) {
      const updated = { ...existing, ...updates };
      this.schedules.set(key, updated);
      this.scheduleCronJob(updated);
      logger.info(`Schedule updated: ${key}`);
    }
  }

  // Manually trigger a report (for testing)
  async triggerManualReport(deviceId: string, period: 'daily' | 'weekly'): Promise<void> {
    logger.info(`Manual report triggered for ${deviceId} (${period})`);

    const schedule: ReportSchedule = {
      deviceId,
      period,
      hour: new Date().getHours(),
      enabled: true,
    };

    await this.generateAndSendReport(schedule);
  }

  // Stop all scheduled jobs
  stopAll(): void {
    for (const [key, job] of this.cronJobs) {
      job.stop();
      logger.info(`Stopped scheduled job: ${key}`);
    }
    this.cronJobs.clear();
  }
}

export const reportingService = new ReportingService();
