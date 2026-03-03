import { Router } from 'express';
import { notificationService } from '../services/notificationService.js';
import { healthMonitoringService } from '../services/healthMonitoringService.js';
import { reportingService } from '../services/reportingService.js';
import { ApiResponse } from '../types/index.js';

const router = Router();

// GET /api/notifications/status - Get notification service status
router.get('/status', (_req, res) => {
  res.json(<ApiResponse>{
    success: true,
    data: {
      emailConfigured: !!process.env.EMAIL_USER,
      feishuConfigured: !!process.env.FEISHU_WEBHOOK,
      recipients: {
        alerts: (process.env.ALERT_RECIPIENTS || '').split(',').filter(Boolean),
        reports: (process.env.REPORT_RECIPIENTS || '').split(',').filter(Boolean),
      },
    },
  });
});

// POST /api/notifications/test - Send a test notification
router.post('/test', async (req, res) => {
  try {
    const result = await notificationService.testNotification();

    res.json(<ApiResponse>{
      success: true,
      message: result ? 'Test notification sent' : 'Test notification failed (check configuration)',
      data: { sent: result },
    });
  } catch (error) {
    res.status(500).json(<ApiResponse>{
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/notifications/health - Get device health status
router.get('/health', (_req, res) => {
  try {
    const healthStatus = healthMonitoringService.getHealthStatus();

    res.json(<ApiResponse>{
      success: true,
      data: Array.from(healthStatus.values()).map(status => ({
        deviceId: status.deviceId,
        online: status.online,
        lastSeen: status.lastSeen,
        offlineDuration: status.offlineDuration,
        isOffline: status.isOffline,
      })),
    });
  } catch (error) {
    res.status(500).json(<ApiResponse>{
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/notifications/health/:deviceId - Get specific device health
router.get('/health/:deviceId', (req, res) => {
  try {
    const { deviceId } = req.params;
    const health = healthMonitoringService.getDeviceHealth(deviceId);

    if (!health) {
      res.status(404).json(<ApiResponse>{
        success: false,
        error: 'Device not found',
      });
      return;
    }

    res.json(<ApiResponse>{
      success: true,
      data: health,
    });
  } catch (error) {
    res.status(500).json(<ApiResponse>{
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/notifications/test-alert - Send a test alert
router.post('/test-alert', async (req, res) => {
  try {
    const { deviceId } = req.body;
    await healthMonitoringService.testAlert(deviceId || 'potato-chamber-01');

    res.json(<ApiResponse>{
      success: true,
      message: 'Test alert sent',
    });
  } catch (error) {
    res.status(500).json(<ApiResponse>{
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/notifications/schedules - Get report schedules
router.get('/schedules', (_req, res) => {
  try {
    const schedules = reportingService.getSchedules();

    res.json(<ApiResponse>{
      success: true,
      data: schedules,
    });
  } catch (error) {
    res.status(500).json(<ApiResponse>{
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/notifications/schedule - Add a report schedule
router.post('/schedule', (req, res) => {
  try {
    const { deviceId, period, hour, minute, dayOfWeek, enabled } = req.body;

    if (!deviceId || !period || hour === undefined) {
      res.status(400).json(<ApiResponse>{
        success: false,
        error: 'Missing required fields: deviceId, period, hour',
      });
      return;
    }

    reportingService.addSchedule({
      deviceId,
      period,
      hour,
      minute,
      dayOfWeek,
      enabled: enabled !== false,
    });

    res.json(<ApiResponse>{
      success: true,
      message: 'Schedule added successfully',
    });
  } catch (error) {
    res.status(500).json(<ApiResponse>{
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// DELETE /api/notifications/schedule/:deviceId/:period - Remove a schedule
router.delete('/schedule/:deviceId/:period', (req, res) => {
  try {
    const { deviceId, period } = req.params;

    reportingService.removeSchedule(deviceId, period as 'daily' | 'weekly');

    res.json(<ApiResponse>{
      success: true,
      message: 'Schedule removed successfully',
    });
  } catch (error) {
    res.status(500).json(<ApiResponse>{
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/notifications/report/:deviceId - Trigger a manual report
router.post('/report/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { period = 'daily' } = req.body;

    await reportingService.triggerManualReport(deviceId, period);

    res.json(<ApiResponse>{
      success: true,
      message: `Manual ${period} report triggered`,
    });
  } catch (error) {
    res.status(500).json(<ApiResponse>{
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
