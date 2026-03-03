import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { database } from './config/database.js';
import { mqttService } from './config/mqtt.js';
import { sensorService, scheduleService } from './services/index.js';
import { healthMonitoringService } from './services/healthMonitoringService.js';
import { reportingService } from './services/reportingService.js';
import { logger } from './utils/logger.js';
import sensorRoutes from './routes/sensorRoutes.js';
import controlRoutes from './routes/controlRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/sensor', sensorRoutes);
app.use('/api/control', controlRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'online',
    mqtt: mqttService.isConnected(),
    monitoring: healthMonitoringService.getHealthStatus().size > 0,
    timestamp: new Date().toISOString(),
  });
});

// Serve dashboard
app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
  });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: any) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

// MQTT event handlers
mqttService.on('sensorData', async (data) => {
  await sensorService.handleSensorData(data);
});

mqttService.on('deviceStatus', async (data) => {
  logger.info('Device status update:', data);
});

mqttService.on('deviceResponse', (data) => {
  logger.info('Device response:', data);
});

// Schedule checker (runs every minute)
setInterval(() => {
  scheduleService.executeDueSchedules().catch(err => {
    logger.error('Error executing due schedules:', err);
  });
}, 60000);

// Cleanup old sensor data (runs daily at 2 AM)
const scheduleCleanup = () => {
  const now = new Date();
  const next2AM = new Date(now);
  next2AM.setHours(2, 0, 0, 0);
  if (next2AM <= now) {
    next2AM.setDate(next2AM.getDate() + 1);
  }
  const msUntil2AM = next2AM.getTime() - now.getTime();

  setTimeout(async () => {
    const { sensorModel } = await import('./models/index.js');
    sensorModel.cleanup(30).then(deleted => {
      logger.info(`Cleaned up ${deleted} old sensor readings`);
    }).catch(err => {
      logger.error('Error cleaning up sensor data:', err);
    });

    // Schedule next day
    setInterval(scheduleCleanup, 24 * 60 * 60 * 1000);
  }, msUntil2AM);
};

async function start() {
  try {
    // Connect to database
    logger.info('Connecting to database...');
    await database.connect();
    await database.initSchema();

    // Connect to MQTT broker
    logger.info('Connecting to MQTT broker...');
    await mqttService.connect();

    // Start health monitoring service (checks every 60 seconds)
    logger.info('Starting health monitoring service...');
    healthMonitoringService.start(60000);

    // Start reporting service (scheduled reports)
    logger.info('Starting reporting service...');
    logger.info('  - Daily report: 8:00 AM');
    logger.info('  - Weekly report: Sunday 9:00 AM');

    // Start schedule cleanup
    scheduleCleanup();

    // Start HTTP server
    app.listen(PORT, () => {
      logger.info(`========================================`);
      logger.info(`🥔 Potato Cultivation System Server`);
      logger.info(`========================================`);
      logger.info(`Server running on http://localhost:${PORT}`);
      logger.info(`Dashboard: http://localhost:${PORT}`);
      logger.info(`MQTT: ${mqttService.isConnected() ? 'Connected' : 'Disconnected'}`);
      logger.info(`Health Monitoring: Active`);
      logger.info(`Reporting: Scheduled (daily/weekly)`);
      logger.info(`========================================\n`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  healthMonitoringService.stop();
  reportingService.stopAll();
  mqttService.disconnect();
  await database.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  healthMonitoringService.stop();
  reportingService.stopAll();
  mqttService.disconnect();
  await database.disconnect();
  process.exit(0);
});

// Start the server
start();
