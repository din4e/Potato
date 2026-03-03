import mysql from 'mysql2/promise';
import { logger } from '../utils/logger.js';

interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

class Database {
  private pool: mysql.Pool | null = null;
  private config: DatabaseConfig;

  constructor() {
    this.config = {
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306'),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DB || 'potato_system',
    };
  }

  async connect(): Promise<void> {
    try {
      this.pool = mysql.createPool({
        ...this.config,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
      });

      const connection = await this.pool.getConnection();
      logger.info('Database connected successfully');
      connection.release();
    } catch (error) {
      logger.error('Database connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('Database disconnected');
    }
  }

  getPool(): mysql.Pool {
    if (!this.pool) {
      throw new Error('Database not connected');
    }
    return this.pool;
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const pool = this.getPool();
    const [rows] = await pool.execute(sql, params);
    return rows as T[];
  }

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async insert(sql: string, params: any[] = []): Promise<number> {
    const pool = this.getPool();
    const [result] = await pool.execute(sql, params);
    return (result as any).insertId;
  }

  async update(sql: string, params: any[] = []): Promise<number> {
    const pool = this.getPool();
    const [result] = await pool.execute(sql, params);
    return (result as any).affectedRows;
  }

  async delete(sql: string, params: any[] = []): Promise<number> {
    const pool = this.getPool();
    const [result] = await pool.execute(sql, params);
    return (result as any).affectedRows;
  }

  async initSchema(): Promise<void> {
    const schemas = [
      // Devices table
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

      // Sensor readings table
      `CREATE TABLE IF NOT EXISTS sensor_readings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(100) NOT NULL,
        sensor_type ENUM('soil_moisture_1', 'soil_moisture_2', 'temperature', 'humidity') NOT NULL,
        value DECIMAL(10, 2) NOT NULL,
        unit VARCHAR(20) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_device_sensor (device_id, sensor_type),
        INDEX idx_timestamp (timestamp),
        FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
      )`,

      // Irrigation logs table
      `CREATE TABLE IF NOT EXISTS irrigation_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(100) NOT NULL,
        duration INT NOT NULL COMMENT 'Duration in milliseconds',
        trigger_reason ENUM('manual', 'auto', 'schedule') NOT NULL,
        soil_moisture_before DECIMAL(10, 2),
        soil_moisture_after DECIMAL(10, 2),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_device_timestamp (device_id, timestamp),
        FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
      )`,

      // Irrigation schedules table
      `CREATE TABLE IF NOT EXISTS irrigation_schedules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        time TIME NOT NULL,
        days_of_week VARCHAR(20) NOT NULL COMMENT 'Comma-separated days 0-6',
        duration INT NOT NULL COMMENT 'Duration in seconds',
        enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_device_enabled (device_id, enabled),
        FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
      )`,

      // Alerts table
      `CREATE TABLE IF NOT EXISTS alerts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(100) NOT NULL,
        alert_type VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        severity ENUM('info', 'warning', 'critical') DEFAULT 'info',
        acknowledged BOOLEAN DEFAULT FALSE,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_device_acknowledged (device_id, acknowledged),
        INDEX idx_timestamp (timestamp),
        FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
      )`,

      // Settings table
      `CREATE TABLE IF NOT EXISTS settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(100) DEFAULT NULL,
        key_name VARCHAR(100) NOT NULL,
        key_value TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_device_key (device_id, key_name)
      )`,
    ];

    const pool = this.getPool();
    const connection = await pool.getConnection();

    try {
      for (const schema of schemas) {
        await connection.execute(schema);
      }
      logger.info('Database schema initialized');
    } finally {
      connection.release();
    }
  }
}

export const database = new Database();
