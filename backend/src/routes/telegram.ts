import { Router } from 'express';
import db from '../database';
import {
  initTelegramBot,
  stopTelegramBot,
  updateCheckinTime,
  triggerCheckin,
  getBotStatus,
  generateChartUrl,
} from '../services/telegram';

const router = Router();

function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

function setSetting(key: string, value: string) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)').run(key, value);
}

// GET /api/telegram/status
router.get('/status', (req, res) => {
  const status = getBotStatus();
  res.json({
    ...status,
    tokenConfigured: !!getSetting('telegram_bot_token'),
  });
});

// POST /api/telegram/configure - save token and start bot
router.post('/configure', (req, res) => {
  const { token, checkinTime, chatId } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Bot token is required' });
  }

  // Validate time format
  if (checkinTime && !/^\d{2}:\d{2}$/.test(checkinTime)) {
    return res.status(400).json({ error: 'checkinTime must be in HH:MM format' });
  }

  setSetting('telegram_bot_token', token);
  if (checkinTime) setSetting('telegram_checkin_time', checkinTime);
  if (chatId) setSetting('telegram_chat_id', String(chatId));

  const success = initTelegramBot(token);

  if (!success) {
    return res.status(500).json({ error: 'Failed to start bot. Check your token.' });
  }

  res.json({ success: true, message: 'Telegram bot started successfully' });
});

// POST /api/telegram/stop
router.post('/stop', (req, res) => {
  stopTelegramBot();
  res.json({ success: true, message: 'Telegram bot stopped' });
});

// POST /api/telegram/schedule - update check-in time
router.post('/schedule', (req, res) => {
  const { time } = req.body;

  if (!time || !/^\d{2}:\d{2}$/.test(time)) {
    return res.status(400).json({ error: 'time must be in HH:MM format' });
  }

  updateCheckinTime(time);
  res.json({ success: true, message: `Check-in scheduled for ${time} daily` });
});

// POST /api/telegram/checkin/trigger - manually trigger check-in
router.post('/checkin/trigger', (req, res) => {
  const chatIdSetting = getSetting('telegram_chat_id');
  const chatId = chatIdSetting ? parseInt(chatIdSetting) : null;

  if (!chatId) {
    return res.status(400).json({ error: 'No chat ID configured. Send /start to the bot first.' });
  }

  triggerCheckin(chatId)
    .then(() => res.json({ success: true, message: 'Check-in triggered' }))
    .catch((err: Error) => res.status(500).json({ error: err.message }));
});

// GET /api/telegram/checkins - get check-in history
router.get('/checkins', (req, res) => {
  const { days = 30 } = req.query;
  const cutoff = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);

  const checkins = db.prepare(
    `SELECT * FROM telegram_checkins WHERE date >= ? ORDER BY date DESC`
  ).all(cutoff);

  res.json(checkins);
});

// GET /api/telegram/weight - get weight history
router.get('/weight', (req, res) => {
  const { days = 30 } = req.query;
  const cutoff = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);

  const rows = db.prepare(
    'SELECT * FROM weight_logs WHERE date >= ? ORDER BY date ASC'
  ).all(cutoff);

  res.json(rows);
});

// POST /api/telegram/weight - manually add weight
router.post('/weight', (req, res) => {
  const { date, weight_kg, notes } = req.body;

  if (!date || !weight_kg) {
    return res.status(400).json({ error: 'date and weight_kg are required' });
  }

  db.prepare(
    `INSERT OR REPLACE INTO weight_logs (date, weight_kg, notes, source) VALUES (?, ?, ?, 'manual')`
  ).run(date, weight_kg, notes || null);

  res.json({ success: true });
});

// GET /api/telegram/mood - get mood history
router.get('/mood', (req, res) => {
  const { days = 30 } = req.query;
  const cutoff = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);

  const rows = db.prepare(
    'SELECT * FROM mood_logs WHERE date >= ? ORDER BY date ASC'
  ).all(cutoff);

  res.json(rows);
});

// POST /api/telegram/mood - manually add mood
router.post('/mood', (req, res) => {
  const { date, mood_score, notes } = req.body;

  if (!date || !mood_score) {
    return res.status(400).json({ error: 'date and mood_score are required' });
  }

  if (mood_score < 1 || mood_score > 10) {
    return res.status(400).json({ error: 'mood_score must be between 1 and 10' });
  }

  db.prepare(
    `INSERT OR REPLACE INTO mood_logs (date, mood_score, notes, source) VALUES (?, ?, ?, 'manual')`
  ).run(date, mood_score, notes || null);

  res.json({ success: true });
});

// GET /api/telegram/charts - get chart URLs
router.get('/charts', (req, res) => {
  const { days = 30 } = req.query;
  const d = Number(days);

  res.json({
    weight: generateChartUrl('weight', d),
    mood: generateChartUrl('mood', d),
    calories: generateChartUrl('calories', d),
  });
});

export default router;
