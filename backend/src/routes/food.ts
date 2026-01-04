import express from 'express';
import multer from 'multer';
import path from 'path';
import db from '../database';
import { format, subDays } from 'date-fns';

const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'food-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Log food with optional image
router.post('/', upload.single('image'), (req, res) => {
  const { date, time, foodName, calories, notes, tags } = req.body;
  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

  if (!date || !time || !foodName) {
    return res.status(400).json({ error: 'Date, time, and food name are required' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO food_logs (date, time, food_name, calories, image_path, notes, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(date, time, foodName, calories || null, imagePath, notes || null, tags || null);

    res.json({
      message: 'Food logged successfully',
      id: result.lastInsertRowid,
      imagePath
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get food logs by date range
router.get('/', (req, res) => {
  const endDate = req.query.endDate as string || format(new Date(), 'yyyy-MM-dd');
  const startDate = req.query.startDate as string || format(subDays(new Date(), 30), 'yyyy-MM-dd');

  const stmt = db.prepare(`
    SELECT * FROM food_logs
    WHERE date BETWEEN ? AND ?
    ORDER BY date DESC, time DESC
  `);

  const logs = stmt.all(startDate, endDate);
  res.json(logs);
});

// Get food logs for specific date
router.get('/date/:date', (req, res) => {
  const { date } = req.params;

  const stmt = db.prepare(`
    SELECT * FROM food_logs
    WHERE date = ?
    ORDER BY time ASC
  `);

  const logs = stmt.all(date);
  res.json(logs);
});

// Update food log
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { foodName, calories, notes, tags } = req.body;

  try {
    const stmt = db.prepare(`
      UPDATE food_logs
      SET food_name = ?, calories = ?, notes = ?, tags = ?
      WHERE id = ?
    `);

    stmt.run(foodName, calories || null, notes || null, tags || null, id);
    res.json({ message: 'Food log updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete food log
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  try {
    const stmt = db.prepare('DELETE FROM food_logs WHERE id = ?');
    stmt.run(id);
    res.json({ message: 'Food log deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get daily calorie totals
router.get('/calories/daily', (req, res) => {
  const endDate = req.query.endDate as string || format(new Date(), 'yyyy-MM-dd');
  const startDate = req.query.startDate as string || format(subDays(new Date(), 30), 'yyyy-MM-dd');

  const stmt = db.prepare(`
    SELECT date, SUM(calories) as total_calories, COUNT(*) as meal_count
    FROM food_logs
    WHERE date BETWEEN ? AND ?
    AND calories IS NOT NULL
    GROUP BY date
    ORDER BY date DESC
  `);

  const data = stmt.all(startDate, endDate);
  res.json(data);
});

export default router;
