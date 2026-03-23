import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(__dirname, '../data/health.db'));

// Initialize database schema
export function initDatabase() {
  // Garmin health data table
  db.exec(`
    CREATE TABLE IF NOT EXISTS garmin_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      sleep_hours REAL,
      sleep_quality INTEGER,
      steps INTEGER,
      heart_rate_avg INTEGER,
      heart_rate_resting INTEGER,
      stress_level INTEGER,
      energy_level INTEGER,
      calories_burned INTEGER,
      active_minutes INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(date)
    )
  `);

  // Food logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS food_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      food_name TEXT NOT NULL,
      calories INTEGER,
      image_path TEXT,
      notes TEXT,
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Habits/events table (for tracking things like coffee intake)
  db.exec(`
    CREATE TABLE IF NOT EXISTS habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      habit_type TEXT NOT NULL,
      description TEXT,
      intensity INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Correlations/insights table (to store detected patterns)
  db.exec(`
    CREATE TABLE IF NOT EXISTS insights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      insight_type TEXT NOT NULL,
      trigger TEXT NOT NULL,
      effect TEXT NOT NULL,
      correlation_score REAL,
      sample_size INTEGER,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // User settings/preferences
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Weight logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS weight_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      weight_kg REAL NOT NULL,
      notes TEXT,
      source TEXT DEFAULT 'manual',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(date)
    )
  `);

  // Mood logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS mood_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      mood_score INTEGER NOT NULL,
      notes TEXT,
      source TEXT DEFAULT 'manual',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(date)
    )
  `);

  // Telegram check-in state table
  db.exec(`
    CREATE TABLE IF NOT EXISTS telegram_checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      food_log TEXT,
      weight_kg REAL,
      mood_score INTEGER,
      mood_notes TEXT,
      completed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(date, chat_id)
    )
  `);

  console.log('Database initialized successfully');
}

export default db;
