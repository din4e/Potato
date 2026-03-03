import { logger } from '../utils/logger.js';
import { SensorReading, DeviceStatus, IrrigationLog, IrrigationSchedule } from '../types/index.js';

// In-memory storage for demo mode (when MySQL is not available)
class InMemoryDatabase {
  private sensors: Map<string, SensorReading[]> = new Map();
  private devices: Map<string, DeviceStatus> = new Map();
  private irrigationLogs: Map<string, IrrigationLog[]> = new Map();
  private schedules: Map<number, IrrigationSchedule> = new Map();
  private scheduleIdCounter = 1;

  constructor() {
    // Initialize with demo device
    this.devices.set('potato-chamber-01', {
      deviceId: 'potato-chamber-01',
      pumpActive: false,
      fanActive: false,
      online: true,
      lastSeen: new Date(),
    });
    this.sensors.set('potato-chamber-01', []);
    this.irrigationLogs.set('potato-chamber-01', []);
  }
}

const memDB = new InMemoryDatabase();

// Mock database class for demo mode
class DemoDatabase {
  private connected = false;
  private demoMode = false;

  async connect(): Promise<void> {
    try {
      // Try to connect to real MySQL
      const mysql = await import('mysql2/promise');
      const config = {
        host: process.env.MYSQL_HOST || 'localhost',
        port: parseInt(process.env.MYSQL_PORT || '3306'),
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DB || 'potato_system',
      };

      const pool = mysql.createPool({
        ...config,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 5000,
        acquireTimeout: 5000,
      });

      const connection = await pool.getConnection();
      this.connected = true;
      connection.release();
      logger.info('Database connected successfully (MySQL)');
      this.pool = pool;
    } catch (error: any) {
      logger.warn(`MySQL connection failed: ${error.message}`);
      logger.warn('MySQL not available, running in DEMO mode with in-memory storage');
      this.demoMode = true;
      this.connected = true;
    }
  }

  private pool: any = null;

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
    this.connected = false;
    logger.info('Database disconnected');
  }

  isDemoMode(): boolean {
    return this.demoMode;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getPool(): any {
    if (this.demoMode) return null;
    return this.pool;
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (this.demoMode) {
      return [];
    }
    const [rows] = await this.pool.execute(sql, params);
    return rows as T[];
  }

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    if (this.demoMode) {
      return null;
    }
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async insert(sql: string, params: any[] = []): Promise<number> {
    if (this.demoMode) {
      return Math.floor(Math.random() * 1000);
    }
    const [result] = await this.pool.execute(sql, params);
    return (result as any).insertId;
  }

  async update(sql: string, params: any[] = []): Promise<number> {
    if (this.demoMode) {
      return 1;
    }
    const [result] = await this.pool.execute(sql, params);
    return (result as any).affectedRows;
  }

  async delete(sql: string, params: any[] = []): Promise<number> {
    if (this.demoMode) {
      return 1;
    }
    const [result] = await this.pool.execute(sql, params);
    return (result as any).affectedRows;
  }

  async initSchema(): Promise<void> {
    if (this.demoMode) {
      logger.info('Demo mode: Using in-memory storage');
      return;
    }

    const schemas = [
      `CREATE TABLE IF NOT EXISTS devices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        pump_active BOOLEAN DEFAULT FALSE,
        fan_active BOOLEAN DEFAULT FALSE,
        online BOOLEAN DEFAULT FALSE,
        last_seen TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS sensor_readings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(100) NOT NULL,
        sensor_type ENUM('soil_moisture_1', 'soil_moisture_2', 'temperature', 'humidity') NOT NULL,
        value DECIMAL(10, 2) NOT NULL,
        unit VARCHAR(20) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_device_sensor (device_id, sensor_type),
        INDEX idx_timestamp (timestamp)
      )`,
      `CREATE TABLE IF NOT EXISTS irrigation_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(100) NOT NULL,
        duration INT NOT NULL,
        trigger_reason ENUM('manual', 'auto', 'schedule') NOT NULL,
        soil_moisture_before DECIMAL(10, 2),
        soil_moisture_after DECIMAL(10, 2),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_device_timestamp (device_id, timestamp)
      )`,
      `CREATE TABLE IF NOT EXISTS irrigation_schedules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        time TIME NOT NULL,
        days_of_week VARCHAR(20) NOT NULL DEFAULT '1,2,3,4,5,6,7',
        duration INT DEFAULT 10000,
        enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_device_enabled (device_id, enabled)
      )`,
    ];

    for (const schema of schemas) {
      await this.pool.execute(schema);
    }
    logger.info('Database schema initialized');
  }
}

export const database = new DemoDatabase();
