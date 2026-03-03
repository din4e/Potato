import { Router } from 'express';
import { controlController, scheduleController } from '../controllers/controlController.js';

const router = Router();

// Device control endpoints
// POST /api/control/:deviceId/pump - Control water pump
router.post('/:deviceId/pump', (req, res) => controlController.controlPump(req, res));

// POST /api/control/:deviceId/fan - Control fan
router.post('/:deviceId/fan', (req, res) => controlController.controlFan(req, res));

// GET /api/control/:deviceId/status - Get device status
router.get('/:deviceId/status', (req, res) => controlController.getStatus(req, res));

// GET /api/control/devices - Get all devices
router.get('/devices', (req, res) => controlController.getAllDevices(req, res));

// Irrigation logs
// GET /api/control/:deviceId/logs - Get irrigation logs
router.get('/:deviceId/logs', (req, res) => controlController.getIrrigationLogs(req, res));

// Schedule endpoints
// POST /api/control/schedule - Create irrigation schedule
router.post('/schedule', (req, res) => scheduleController.create(req, res));

// GET /api/control/:deviceId/schedules - Get device schedules
router.get('/:deviceId/schedules', (req, res) => scheduleController.getByDevice(req, res));

// PUT /api/control/schedule/:id - Update schedule
router.put('/schedule/:id', (req, res) => scheduleController.update(req, res));

// DELETE /api/control/schedule/:id - Delete schedule
router.delete('/schedule/:id', (req, res) => scheduleController.delete(req, res));

export default router;
