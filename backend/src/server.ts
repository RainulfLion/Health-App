import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { initDatabase } from './database';

import garminRoutes from './routes/garmin';
import foodRoutes from './routes/food';
import habitsRoutes from './routes/habits';
import analyticsRoutes from './routes/analytics';
import telegramRoutes from './routes/telegram';
import { initTelegramBot } from './services/telegram';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure necessary directories exist
const uploadsDir = path.join(__dirname, '../uploads');
const dataDir = path.join(__dirname, '../data');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Serve uploaded images
app.use('/uploads', express.static(uploadsDir));

// Initialize database
initDatabase();

// API routes
app.use('/api/garmin', garminRoutes);
app.use('/api/food', foodRoutes);
app.use('/api/habits', habitsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/telegram', telegramRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Health App API server running on http://localhost:${PORT}`);
  console.log(`📊 Database initialized`);
  console.log(`📁 Uploads directory: ${uploadsDir}`);

  // Auto-start Telegram bot if token is saved
  const db = require('./database').default;
  const tokenRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('telegram_bot_token') as { value: string } | undefined;
  if (tokenRow?.value) {
    console.log('🤖 Restoring Telegram bot...');
    initTelegramBot(tokenRow.value);
  }
});

export default app;
