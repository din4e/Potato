import { Router } from 'express';
import { costController } from '../controllers/costController.js';

const router = Router();

// GET /api/cost/:deviceId - Get all cost items for a device
router.get('/:deviceId', (req, res) => costController.getAll(req, res));

// GET /api/cost/:deviceId/summary - Get cost summary
router.get('/:deviceId/summary', (req, res) => costController.getSummary(req, res));

// GET /api/cost/:deviceId/category-config - Get category configuration
router.get('/:deviceId/category-config', (req, res) => costController.getCategoryConfig(req, res));

// PUT /api/cost/:deviceId/category-config - Update category configuration
router.put('/:deviceId/category-config', (req, res) => costController.updateCategoryConfig(req, res));

// POST /api/cost/:deviceId - Create a new cost item
router.post('/:deviceId', (req, res) => costController.create(req, res));

// PUT /api/cost/:deviceId/:id - Update a cost item
router.put('/:deviceId/:id', (req, res) => costController.update(req, res));

// DELETE /api/cost/:deviceId/:id - Delete a cost item
router.delete('/:deviceId/:id', (req, res) => costController.delete(req, res));

export default router;
