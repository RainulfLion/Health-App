import express from 'express';
import analyticsService from '../services/analytics';
import db from '../database';

const router = express.Router();

// Get all insights for a time period
router.get('/insights', (req, res) => {
  const days = parseInt(req.query.days as string) || 30;

  try {
    const insights = analyticsService.getAllInsights(days);

    // Save significant insights to database
    insights.forEach(insight => {
      if (Math.abs(insight.score) > 5 && insight.sampleSize >= 3) {
        analyticsService.saveInsight(insight);
      }
    });

    res.json(insights);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Analyze specific habit
router.get('/habit/:habitType', (req, res) => {
  const { habitType } = req.params;
  const days = parseInt(req.query.days as string) || 30;

  try {
    const insights = analyticsService.analyzeHabitImpact(habitType, days);
    res.json(insights);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Analyze food timing patterns
router.get('/food-timing', (req, res) => {
  const days = parseInt(req.query.days as string) || 30;

  try {
    const insights = analyticsService.analyzeFoodTiming(days);
    res.json(insights);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get saved insights from database
router.get('/saved', (req, res) => {
  const stmt = db.prepare(`
    SELECT * FROM insights
    ORDER BY ABS(correlation_score) DESC, updated_at DESC
    LIMIT 20
  `);

  const insights = stmt.all();
  res.json(insights);
});

// Get dashboard summary
router.get('/dashboard', (req, res) => {
  const days = parseInt(req.query.days as string) || 7;

  try {
    // Get recent Garmin data summary
    const garminStmt = db.prepare(`
      SELECT
        AVG(sleep_hours) as avg_sleep,
        AVG(sleep_quality) as avg_sleep_quality,
        AVG(steps) as avg_steps,
        AVG(energy_level) as avg_energy,
        AVG(stress_level) as avg_stress
      FROM garmin_data
      WHERE date >= date('now', '-${days} days')
    `);
    const garminSummary = garminStmt.get();

    // Get food summary
    const foodStmt = db.prepare(`
      SELECT
        COUNT(*) as total_meals,
        AVG(calories) as avg_calories_per_meal,
        SUM(calories) / ${days} as avg_daily_calories
      FROM food_logs
      WHERE date >= date('now', '-${days} days')
      AND calories IS NOT NULL
    `);
    const foodSummary = foodStmt.get();

    // Get habit summary
    const habitStmt = db.prepare(`
      SELECT habit_type, COUNT(*) as count
      FROM habits
      WHERE date >= date('now', '-${days} days')
      GROUP BY habit_type
      ORDER BY count DESC
    `);
    const habitSummary = habitStmt.all();

    // Get top insights
    const insights = analyticsService.getAllInsights(days).slice(0, 5);

    res.json({
      period: `Last ${days} days`,
      health: garminSummary,
      nutrition: foodSummary,
      habits: habitSummary,
      topInsights: insights
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
