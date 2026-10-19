const express = require('express');
const router = express.Router();
const Activity = require('../models/Activity');
const Target = require('../models/Target');
const { calculateCarbon } = require('../services/carbonCalculator');
const { getWeekBounds } = require('../services/dashboardService');

/**
 * POST /api/demo/seed
 * Populates realistic demo activities within the current week.
 * Avoids duplicate duplication if demo activities are already present.
 */
router.post('/seed', async (req, res, next) => {
  try {
    const { monday } = getWeekBounds();

    // When force=true, clear prior demo activities first
    if (req.query.force) {
      await Activity.deleteMany({ note: { $regex: /\[Demo\]/i } });
    } else {
      const existingDemo = await Activity.find({
        note: { $regex: /\[Demo\]/i },
      });
      if (existingDemo.length > 0) {
        return res.json({
          success: true,
          message: 'Demo data is already loaded for the current week.',
          data: existingDemo,
        });
      }
    }

    const getDayDate = (dayOffset, hours, minutes) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + dayOffset);
      d.setHours(hours, minutes, 0, 0);
      return d;
    };

    const demoItems = [
      // Monday (Total: 5.40 kg CO₂e)
      { type: 'car', quantity: 10, date: getDayDate(0, 8, 30), note: '[Demo] Morning office commute' },
      { type: 'veg_meal', quantity: 1, date: getDayDate(0, 13, 0), note: '[Demo] Vegetarian cafe lunch' },
      { type: 'electricity', quantity: 3, date: getDayDate(0, 19, 30), note: '[Demo] Evening home lighting & laptop' },

      // Tuesday (Total: 5.50 kg CO₂e)
      { type: 'bike', quantity: 15, date: getDayDate(1, 9, 0), note: '[Demo] Motorcycle commute' },
      { type: 'lpg', quantity: 0.5, date: getDayDate(1, 12, 30), note: '[Demo] LPG cylinder gas for cooking' },
      { type: 'non_veg_meal', quantity: 1, date: getDayDate(1, 19, 45), note: '[Demo] Chicken dinner' },

      // Wednesday (Total: 5.20 kg CO₂e)
      { type: 'bus', quantity: 12.5, date: getDayDate(2, 8, 45), note: '[Demo] Public bus transit' },
      { type: 'train', quantity: 20, date: getDayDate(2, 17, 30), note: '[Demo] Metro rail transit' },
      { type: 'electricity', quantity: 3, date: getDayDate(2, 20, 0), note: '[Demo] Home office workstation power' },
      { type: 'veg_meal', quantity: 1, date: getDayDate(2, 13, 15), note: '[Demo] Plant-based lunch' },

      // Thursday (Total: 5.90 kg CO₂e)
      { type: 'car', quantity: 8, date: getDayDate(3, 9, 15), note: '[Demo] Grocery & errands drive' },
      { type: 'wood', quantity: 1, date: getDayDate(3, 18, 0), note: '[Demo] Firewood / wood heating fuel' },
      { type: 'non_veg_meal', quantity: 1, date: getDayDate(3, 20, 30), note: '[Demo] Non-vegetarian family dinner' },

      // Friday (Total: 5.00 kg CO₂e)
      { type: 'bike', quantity: 10, date: getDayDate(4, 8, 30), note: '[Demo] Scooter ride to office' },
      { type: 'electricity', quantity: 2.5, date: getDayDate(4, 18, 45), note: '[Demo] Friday electronics & AC' },
      { type: 'veg_meal', quantity: 2, date: getDayDate(4, 13, 0), note: '[Demo] Vegetarian lunch & light dinner' },

      // Saturday (Total: 4.20 kg CO₂e)
      { type: 'train', quantity: 25, date: getDayDate(5, 11, 0), note: '[Demo] Weekend metro trip to museum' },
      { type: 'coal', quantity: 0.5, date: getDayDate(5, 17, 30), note: '[Demo] Solid coal fuel usage' },
      { type: 'veg_meal', quantity: 2, date: getDayDate(5, 19, 0), note: '[Demo] Home-cooked vegetarian meals' },

      // Sunday (Total: 8.90 kg CO₂e)
      { type: 'flight', quantity: 16, date: getDayDate(6, 10, 0), note: '[Demo] Short regional flight' },
      { type: 'bus', quantity: 10, date: getDayDate(6, 14, 0), note: '[Demo] Airport express bus' },
      { type: 'electricity', quantity: 2, date: getDayDate(6, 21, 0), note: '[Demo] Sunday night lights & devices' },
      { type: 'non_veg_meal', quantity: 1, date: getDayDate(6, 19, 30), note: '[Demo] Sunday non-veg dinner' },
    ];

    const activitiesToSave = demoItems.map((item) => {
      const calc = calculateCarbon(item.type, item.quantity);
      return {
        type: calc.type,
        quantity: calc.quantity,
        unit: calc.unit,
        emissionFactor: calc.emissionFactor,
        co2: calc.co2,
        date: item.date,
        note: item.note,
      };
    });

    const savedActivities = await Activity.insertMany(activitiesToSave);

    // Ensure default weekly target (38.5 kg) and daily target (5.5 kg)
    let target = await Target.findOne();
    if (!target) {
      target = await Target.create({ weeklyTarget: 38.5, dailyTarget: 5.5 });
    } else {
      target.weeklyTarget = 38.5;
      target.dailyTarget = 5.5;
      await target.save();
    }

    res.status(201).json({
      success: true,
      message: 'Realistic demo activities successfully loaded for the full week!',
      count: savedActivities.length,
      data: savedActivities,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/demo/clear
 * Clears demo or all activities for quick re-testing
 */
router.delete('/clear', async (req, res, next) => {
  try {
    await Activity.deleteMany({});
    res.json({
      success: true,
      message: 'All activities cleared.',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
