const express = require('express');
const router = express.Router();
const Holiday = require('../models/Holiday');
const { authMiddleware, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

// @route   GET /api/holiday
// @desc    Get all holidays
// @access  Private
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { year } = req.query;
    let query = { is_active: true };

    if (year) {
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year, 11, 31, 23, 59, 59);
      query.date = { $gte: startOfYear, $lte: endOfYear };
    }

    const holidays = await Holiday.find(query).sort({ date: 1 });
    res.json({ success: true, data: holidays });
  } catch (error) {
    logger.error('Get holidays error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   POST /api/holiday
// @desc    Create a holiday
// @access  Private (HR, SUPER_ADMIN)
router.post('/', authMiddleware, authorize('HR', 'SUPER_ADMIN'), async (req, res) => {
  try {
    const { name, date, type } = req.body;

    const holiday = new Holiday({
      name,
      date,
      type,
      created_by: req.user.id
    });

    await holiday.save();
    res.status(201).json({ success: true, data: holiday });
  } catch (error) {
    logger.error('Create holiday error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   DELETE /api/holiday/:id
// @desc    Delete a holiday (soft delete)
// @access  Private (HR, SUPER_ADMIN)
router.delete('/:id', authMiddleware, authorize('HR', 'SUPER_ADMIN'), async (req, res) => {
  try {
    const holiday = await Holiday.findById(req.params.id);
    if (!holiday) {
      return res.status(404).json({ success: false, error: 'Holiday not found' });
    }

    holiday.is_active = false;
    await holiday.save();

    res.json({ success: true, message: 'Holiday deleted' });
  } catch (error) {
    logger.error('Delete holiday error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
