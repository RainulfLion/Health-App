import express from 'express';
import db from '../database';
import { format, subDays } from 'date-fns';

const router = express.Router();

// Log a habit/event
router.post('/', (req, res) => {
  const { date, time, habitType, description, intensity } = req.body;

  if (!date || !time || !habitType) {
    return res.status(400).json({ error: 'Date, time, and habit type are required' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO habits (date, time, habit_type, description, intensity)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      date,
      time,
      habitType,
      description || null,
      intensity || null
    );

    res.json({
      message: 'Habit logged successfully',
      id: result.lastInsertRowid
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get habits by date range
router.get('/', (req, res) => {
  const endDate = req.query.endDate as string || format(new Date(), 'yyyy-MM-dd');
  const startDate = req.query.startDate as string || format(subDays(new Date(), 30), 'yyyy-MM-dd');

  const stmt = db.prepare(`
    SELECT * FROM habits
    WHERE date BETWEEN ? AND ?
    ORDER BY date DESC, time DESC
  `);

  const habits = stmt.all(startDate, endDate);
  res.json(habits);
});

// Get habits for specific date
router.get('/date/:date', (req, res) => {
  const { date } = req.params;

  const stmt = db.prepare(`
    SELECT * FROM habits
    WHERE date = ?
    ORDER BY time ASC
  `);

  const habits = stmt.all(date);
  res.json(habits);
});

// Get habit types (unique list)
router.get('/types', (req, res) => {
  const stmt = db.prepare(`
    SELECT DISTINCT habit_type
    FROM habits
    ORDER BY habit_type
  `);

  const types = stmt.all();
  res.json(types);
});

// Update habit
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { habitType, description, intensity } = req.body;

  try {
    const stmt = db.prepare(`
      UPDATE habits
      SET habit_type = ?, description = ?, intensity = ?
      WHERE id = ?
    `);

    stmt.run(habitType, description || null, intensity || null, id);
    res.json({ message: 'Habit updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete habit
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  try {
    const stmt = db.prepare('DELETE FROM habits WHERE id = ?');
    stmt.run(id);
    res.json({ message: 'Habit deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
