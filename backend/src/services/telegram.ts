import { Telegraf, Context } from 'telegraf';
import * as cron from 'node-cron';
import { format } from 'date-fns';
import axios from 'axios';
import db from '../database';

interface CheckinState {
  step: 'food' | 'weight' | 'mood';
  date: string;
  food?: string;
  weight?: number;
}

const checkinStates = new Map<number, CheckinState>();
let bot: Telegraf | null = null;
let cronJob: cron.ScheduledTask | null = null;

function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

function setSetting(key: string, value: string) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)').run(key, value);
}

function getToday(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

async function sendDailyCheckin(chatId: number) {
  if (!bot) return;
  const date = getToday();

  // Check if already completed today
  const existing = db.prepare(
    'SELECT completed FROM telegram_checkins WHERE date = ? AND chat_id = ?'
  ).get(date, String(chatId)) as { completed: number } | undefined;

  if (existing?.completed) {
    await bot.telegram.sendMessage(chatId,
      `✅ You've already completed today's check-in!\n\nType /summary to see your charts or /history to view recent logs.`
    );
    return;
  }

  checkinStates.set(chatId, { step: 'food', date });

  await bot.telegram.sendMessage(chatId,
    `🌅 *Daily Health Check-in* — ${format(new Date(), 'EEEE, MMMM d')}\n\n` +
    `Let's track your health today! 💪\n\n` +
    `*Step 1/3 — Food* 🍽️\nWhat did you eat today? Describe your meals (breakfast, lunch, dinner, snacks).\n\n` +
    `_(Type 'skip' to skip any step)_`,
    { parse_mode: 'Markdown' }
  );
}

function generateChartUrl(type: 'weight' | 'mood' | 'calories', days: number = 30): string {
  const cutoff = format(new Date(Date.now() - days * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

  let labels: string[] = [];
  let data: number[] = [];
  let label = '';
  let color = '';

  if (type === 'weight') {
    const rows = db.prepare(
      'SELECT date, weight_kg FROM weight_logs WHERE date >= ? ORDER BY date ASC'
    ).all(cutoff) as { date: string; weight_kg: number }[];
    labels = rows.map(r => r.date.slice(5)); // MM-DD
    data = rows.map(r => r.weight_kg);
    label = 'Weight (kg)';
    color = 'rgb(99, 102, 241)';
  } else if (type === 'mood') {
    const rows = db.prepare(
      'SELECT date, mood_score FROM mood_logs WHERE date >= ? ORDER BY date ASC'
    ).all(cutoff) as { date: string; mood_score: number }[];
    labels = rows.map(r => r.date.slice(5));
    data = rows.map(r => r.mood_score);
    label = 'Mood (1-10)';
    color = 'rgb(34, 197, 94)';
  } else if (type === 'calories') {
    const rows = db.prepare(
      `SELECT date, SUM(calories) as total FROM food_logs
       WHERE date >= ? AND calories IS NOT NULL
       GROUP BY date ORDER BY date ASC`
    ).all(cutoff) as { date: string; total: number }[];
    labels = rows.map(r => r.date.slice(5));
    data = rows.map(r => r.total);
    label = 'Calories';
    color = 'rgb(251, 146, 60)';
  }

  if (labels.length === 0) return '';

  const chartConfig = {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label,
        data,
        borderColor: color,
        backgroundColor: color.replace('rgb', 'rgba').replace(')', ', 0.1)'),
        borderWidth: 2,
        pointRadius: 4,
        tension: 0.3,
        fill: true,
      }]
    },
    options: {
      plugins: {
        legend: { display: true }
      },
      scales: {
        y: { beginAtZero: type === 'mood' || type === 'calories' }
      }
    }
  };

  const encoded = encodeURIComponent(JSON.stringify(chartConfig));
  return `https://quickchart.io/chart?c=${encoded}&w=600&h=300&bkg=white`;
}

async function sendSummary(chatId: number, days: number = 30) {
  if (!bot) return;

  await bot.telegram.sendMessage(chatId, `📊 Generating your ${days}-day health summary...`);

  const weightUrl = generateChartUrl('weight', days);
  const moodUrl = generateChartUrl('mood', days);
  const caloriesUrl = generateChartUrl('calories', days);

  // Get stats
  const cutoff = format(new Date(Date.now() - days * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

  const weightStats = db.prepare(
    'SELECT AVG(weight_kg) as avg, MIN(weight_kg) as min, MAX(weight_kg) as max FROM weight_logs WHERE date >= ?'
  ).get(cutoff) as { avg: number; min: number; max: number } | undefined;

  const moodStats = db.prepare(
    'SELECT AVG(mood_score) as avg, MIN(mood_score) as min, MAX(mood_score) as max FROM mood_logs WHERE date >= ?'
  ).get(cutoff) as { avg: number; min: number; max: number } | undefined;

  const checkinCount = db.prepare(
    'SELECT COUNT(*) as count FROM telegram_checkins WHERE date >= ? AND completed = 1'
  ).get(cutoff) as { count: number };

  let statsMsg = `*Your ${days}-Day Health Summary* 📈\n\n`;
  statsMsg += `✅ Check-ins completed: *${checkinCount.count}/${days} days*\n\n`;

  if (weightStats?.avg) {
    statsMsg += `⚖️ *Weight*\n`;
    statsMsg += `  Avg: ${weightStats.avg.toFixed(1)} kg\n`;
    statsMsg += `  Min: ${weightStats.min} kg | Max: ${weightStats.max} kg\n\n`;
  }

  if (moodStats?.avg) {
    statsMsg += `😊 *Mood*\n`;
    statsMsg += `  Avg: ${moodStats.avg.toFixed(1)}/10\n`;
    statsMsg += `  Min: ${moodStats.min} | Max: ${moodStats.max}\n\n`;
  }

  await bot.telegram.sendMessage(chatId, statsMsg, { parse_mode: 'Markdown' });

  if (weightUrl) {
    try {
      await bot.telegram.sendPhoto(chatId, { url: weightUrl }, { caption: '⚖️ Weight trend' });
    } catch { /* skip if chart fails */ }
  }

  if (moodUrl) {
    try {
      await bot.telegram.sendPhoto(chatId, { url: moodUrl }, { caption: '😊 Mood trend' });
    } catch { /* skip if chart fails */ }
  }

  if (caloriesUrl) {
    try {
      await bot.telegram.sendPhoto(chatId, { url: caloriesUrl }, { caption: '🍽️ Daily calories' });
    } catch { /* skip if chart fails */ }
  }
}

async function handleMessage(ctx: Context) {
  if (!ctx.message || !('text' in ctx.message)) return;
  const text = ctx.message.text.trim();
  const chatId = ctx.chat!.id;

  // Commands
  if (text.startsWith('/')) {
    const cmd = text.split(' ')[0].toLowerCase();
    const arg = text.split(' ')[1];

    if (cmd === '/start' || cmd === '/checkin') {
      // Register chat ID
      setSetting('telegram_chat_id', String(chatId));
      await sendDailyCheckin(chatId);
      return;
    }

    if (cmd === '/summary') {
      const days = arg ? parseInt(arg) || 30 : 30;
      await sendSummary(chatId, days);
      return;
    }

    if (cmd === '/history') {
      const rows = db.prepare(
        `SELECT date, food_log, weight_kg, mood_score, mood_notes
         FROM telegram_checkins WHERE chat_id = ? AND completed = 1
         ORDER BY date DESC LIMIT 7`
      ).all(String(chatId)) as any[];

      if (rows.length === 0) {
        await ctx.reply('No check-ins found yet. Type /checkin to start!');
        return;
      }

      let msg = '*Recent Check-ins* 📋\n\n';
      for (const row of rows) {
        msg += `*${row.date}*\n`;
        if (row.food_log) msg += `  🍽️ ${row.food_log}\n`;
        if (row.weight_kg) msg += `  ⚖️ ${row.weight_kg} kg\n`;
        if (row.mood_score) msg += `  😊 Mood: ${row.mood_score}/10${row.mood_notes ? ` — ${row.mood_notes}` : ''}\n`;
        msg += '\n';
      }
      await ctx.reply(msg, { parse_mode: 'Markdown' });
      return;
    }

    if (cmd === '/help') {
      await ctx.reply(
        `*Health Tracker Bot* 🏥\n\n` +
        `*Commands:*\n` +
        `/checkin — Start today's health check-in\n` +
        `/summary [days] — View charts & stats (default: 30 days)\n` +
        `/history — Show last 7 check-ins\n` +
        `/help — Show this message\n\n` +
        `*Daily check-ins are scheduled automatically at your configured time.*`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    await ctx.reply('Unknown command. Type /help for available commands.');
    return;
  }

  // Conversation flow
  const state = checkinStates.get(chatId);
  if (!state) {
    await ctx.reply('Start your daily check-in with /checkin or type /help for commands.');
    return;
  }

  const skip = text.toLowerCase() === 'skip';
  const date = state.date;

  if (state.step === 'food') {
    if (!skip) {
      state.food = text;
      // Log food items to food_logs table
      const time = format(new Date(), 'HH:mm');
      db.prepare(
        `INSERT INTO food_logs (date, time, food_name, notes) VALUES (?, ?, ?, ?)`
      ).run(date, time, text, 'via Telegram');
    }

    state.step = 'weight';
    checkinStates.set(chatId, state);

    await ctx.reply(
      `${skip ? 'Skipped! ' : '✅ Meals logged!\n\n'}` +
      `*Step 2/3 — Weight* ⚖️\nWhat's your weight today? Enter a number (e.g. 75.5).\n\n_(Type 'skip' to skip)_`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  if (state.step === 'weight') {
    if (!skip) {
      const weight = parseFloat(text.replace(/[^\d.]/g, ''));
      if (isNaN(weight) || weight < 20 || weight > 500) {
        await ctx.reply('Please enter a valid weight in kg (e.g. 75.5), or type "skip".');
        return;
      }
      state.weight = weight;

      db.prepare(
        `INSERT OR REPLACE INTO weight_logs (date, weight_kg, source) VALUES (?, ?, 'telegram')`
      ).run(date, weight);
    }

    state.step = 'mood';
    checkinStates.set(chatId, state);

    await ctx.reply(
      `${skip ? 'Skipped! ' : `✅ Weight logged!\n\n`}` +
      `*Step 3/3 — Mood* 😊\nHow are you feeling today? Rate from 1-10 and optionally add a note.\n\nExamples: \`8\` or \`7 feeling energetic\`\n\n_(Type 'skip' to skip)_`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  if (state.step === 'mood') {
    let moodScore: number | undefined;
    let moodNotes: string | undefined;

    if (!skip) {
      const parts = text.split(' ');
      moodScore = parseInt(parts[0]);

      if (isNaN(moodScore) || moodScore < 1 || moodScore > 10) {
        await ctx.reply('Please rate your mood from 1-10 (e.g. "7" or "7 feeling good"), or type "skip".');
        return;
      }

      moodNotes = parts.slice(1).join(' ') || undefined;

      db.prepare(
        `INSERT OR REPLACE INTO mood_logs (date, mood_score, notes, source) VALUES (?, ?, ?, 'telegram')`
      ).run(date, moodScore, moodNotes || null);
    }

    // Save completed check-in
    db.prepare(
      `INSERT OR REPLACE INTO telegram_checkins
       (date, chat_id, food_log, weight_kg, mood_score, mood_notes, completed)
       VALUES (?, ?, ?, ?, ?, ?, 1)`
    ).run(date, String(chatId), state.food || null, state.weight || null, moodScore || null, moodNotes || null);

    checkinStates.delete(chatId);

    let summary = `🎉 *Check-in complete for ${date}!*\n\n`;
    if (state.food) summary += `🍽️ Food: ${state.food.slice(0, 100)}${state.food.length > 100 ? '...' : ''}\n`;
    if (state.weight) summary += `⚖️ Weight: ${state.weight} kg\n`;
    if (moodScore) summary += `😊 Mood: ${moodScore}/10${moodNotes ? ` — ${moodNotes}` : ''}\n`;

    summary += `\nType /summary to see your trends or /history for recent logs.`;

    await ctx.reply(summary, { parse_mode: 'Markdown' });
    return;
  }
}

function scheduleDailyCheckin(time: string) {
  // time format: "HH:MM"
  const [hour, minute] = time.split(':');

  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }

  cronJob = cron.schedule(`${minute} ${hour} * * *`, async () => {
    const chatIdSetting = getSetting('telegram_chat_id');
    if (!chatIdSetting) return;

    const chatId = parseInt(chatIdSetting);
    if (isNaN(chatId)) return;

    await sendDailyCheckin(chatId);
  });

  console.log(`Telegram daily check-in scheduled at ${time}`);
}

export function initTelegramBot(token: string): boolean {
  try {
    if (bot) {
      bot.stop();
      bot = null;
    }

    bot = new Telegraf(token);
    bot.on('message', handleMessage);

    bot.launch().catch((err: Error) => {
      console.error('Telegram bot error:', err.message);
    });

    // Schedule at saved time or default 8:00 AM
    const savedTime = getSetting('telegram_checkin_time') || '08:00';
    scheduleDailyCheckin(savedTime);

    console.log('Telegram bot initialized successfully');
    return true;
  } catch (err) {
    console.error('Failed to initialize Telegram bot:', err);
    return false;
  }
}

export function stopTelegramBot() {
  if (bot) {
    bot.stop();
    bot = null;
  }
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }
}

export function updateCheckinTime(time: string) {
  setSetting('telegram_checkin_time', time);
  scheduleDailyCheckin(time);
}

export function triggerCheckin(chatId: number): Promise<void> {
  return sendDailyCheckin(chatId);
}

export function getBotStatus(): { active: boolean; chatId: string | null; checkinTime: string | null } {
  return {
    active: bot !== null,
    chatId: getSetting('telegram_chat_id'),
    checkinTime: getSetting('telegram_checkin_time'),
  };
}

export { sendSummary, generateChartUrl };
