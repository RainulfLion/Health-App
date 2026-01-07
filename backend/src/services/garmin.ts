import { GarminConnect } from 'garmin-connect';
import db from '../database';
import crypto from 'crypto';
import schedule from 'node-schedule';

export interface GarminData {
  date: string;
  sleepHours?: number;
  sleepQuality?: number;
  steps?: number;
  heartRateAvg?: number;
  heartRateResting?: number;
  stressLevel?: number;
  energyLevel?: number;
  caloriesBurned?: number;
  activeMinutes?: number;
}

interface SessionCookies {
  [key: string]: string;
}

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'health-app-default-key-please-change-in-production-32-chars';
const ALGORITHM = 'aes-256-cbc';

export class GarminService {
  private garminClient: GarminConnect;
  private isAuthenticated: boolean = false;
  private autoSyncJob: schedule.Job | null = null;
  private retryAttempts: number = 0;
  private maxRetries: number = 5;

  constructor() {
    this.garminClient = new GarminConnect({
      username: '',
      password: ''
    });
    this.loadSession();
    this.initializeAutoSync();
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(text: string): string {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private loadSession() {
    try {
      const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');

      // Try to load session cookies
      const cookiesResult = stmt.get('garmin_cookies') as { value: string } | undefined;
      if (cookiesResult?.value) {
        try {
          const cookies = JSON.parse(this.decrypt(cookiesResult.value));
          this.restoreSessionFromCookies(cookies);
          console.log('Restored Garmin session from cookies');
          return;
        } catch (error) {
          console.error('Failed to restore session from cookies:', error);
        }
      }

      // Try to load stored credentials for auto-retry
      const credsResult = stmt.get('garmin_credentials') as { value: string } | undefined;
      if (credsResult?.value) {
        try {
          const creds = JSON.parse(this.decrypt(credsResult.value));
          // Don't auto-login here, but mark that we have credentials
          console.log('Stored credentials available for auto-retry');
        } catch (error) {
          console.error('Failed to load credentials:', error);
        }
      }
    } catch (error) {
      // Database table might not exist yet during initialization
      this.isAuthenticated = false;
    }
  }

  private restoreSessionFromCookies(cookies: SessionCookies) {
    // The garmin-connect library doesn't easily support cookie restoration
    // We'll need to create a new client and manually set cookies if possible
    // For now, mark as not authenticated and require re-login
    // In a full implementation, we'd use the underlying HTTP client
    this.isAuthenticated = false;
  }

  async login(username: string, password: string, saveCredentials: boolean = false): Promise<void> {
    try {
      this.garminClient = new GarminConnect({
        username,
        password
      });

      await this.garminClient.login();
      this.isAuthenticated = true;
      this.retryAttempts = 0;

      // Store session indicator
      const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime("now"))');
      stmt.run('garmin_session', 'active');

      // Save credentials if requested (for auto-retry)
      if (saveCredentials) {
        const encrypted = this.encrypt(JSON.stringify({ username, password }));
        stmt.run('garmin_credentials', encrypted);
        console.log('Credentials saved for auto-retry');
      }

      console.log('Successfully logged in to Garmin Connect');
    } catch (error) {
      this.isAuthenticated = false;
      this.retryAttempts++;
      console.error('Garmin login failed:', error);

      // Check if it's a CAPTCHA error
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.toLowerCase().includes('captcha') || errorMessage.toLowerCase().includes('challenge')) {
        throw new Error('CAPTCHA required. Please use session cookies method or try again later.');
      }

      throw new Error('Failed to authenticate with Garmin Connect. Please check your credentials.');
    }
  }

  async loginWithRetry(maxAttempts: number = 3): Promise<boolean> {
    try {
      const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
      const credsResult = stmt.get('garmin_credentials') as { value: string } | undefined;

      if (!credsResult?.value) {
        console.log('No stored credentials for auto-retry');
        return false;
      }

      const creds = JSON.parse(this.decrypt(credsResult.value));

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          console.log(`Auto-retry login attempt ${attempt}/${maxAttempts}`);
          await this.login(creds.username, creds.password, true);
          return true;
        } catch (error) {
          if (attempt < maxAttempts) {
            // Exponential backoff: 2s, 4s, 8s
            const waitTime = Math.pow(2, attempt) * 1000;
            console.log(`Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }

      return false;
    } catch (error) {
      console.error('Auto-retry failed:', error);
      return false;
    }
  }

  setSessionCookies(cookies: SessionCookies): void {
    try {
      const encrypted = this.encrypt(JSON.stringify(cookies));
      const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime("now"))');
      stmt.run('garmin_cookies', encrypted);

      this.restoreSessionFromCookies(cookies);
      console.log('Session cookies saved');
    } catch (error) {
      console.error('Failed to save session cookies:', error);
      throw new Error('Failed to save session cookies');
    }
  }

  isLoggedIn(): boolean {
    return this.isAuthenticated;
  }

  logout(): void {
    this.isAuthenticated = false;
    const stmt = db.prepare('DELETE FROM settings WHERE key IN (?, ?, ?)');
    stmt.run('garmin_session', 'garmin_cookies', 'garmin_credentials');

    if (this.autoSyncJob) {
      this.autoSyncJob.cancel();
      this.autoSyncJob = null;
    }
  }

  clearStoredCredentials(): void {
    const stmt = db.prepare('DELETE FROM settings WHERE key = ?');
    stmt.run('garmin_credentials');
    console.log('Stored credentials cleared');
  }

  hasStoredCredentials(): boolean {
    try {
      const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
      const result = stmt.get('garmin_credentials') as { value: string } | undefined;
      return !!result?.value;
    } catch (error) {
      return false;
    }
  }

  // Auto-sync functionality
  enableAutoSync(time: string = '06:00'): void {
    if (this.autoSyncJob) {
      this.autoSyncJob.cancel();
    }

    // Parse time (format: "HH:MM")
    const [hour, minute] = time.split(':').map(Number);

    // Schedule daily sync
    this.autoSyncJob = schedule.scheduleJob({ hour, minute }, async () => {
      console.log('Running scheduled Garmin sync...');

      if (!this.isAuthenticated) {
        console.log('Not authenticated, attempting auto-login...');
        const success = await this.loginWithRetry();
        if (!success) {
          console.error('Auto-login failed, skipping sync');
          return;
        }
      }

      try {
        const today = new Date().toISOString().split('T')[0];
        await this.syncData(today);
        console.log('Scheduled sync completed successfully');
      } catch (error) {
        console.error('Scheduled sync failed:', error);

        // Try to re-authenticate and retry once
        if (!this.isAuthenticated) {
          console.log('Retrying with fresh login...');
          const success = await this.loginWithRetry();
          if (success) {
            try {
              const today = new Date().toISOString().split('T')[0];
              await this.syncData(today);
              console.log('Retry sync completed successfully');
            } catch (retryError) {
              console.error('Retry sync also failed:', retryError);
            }
          }
        }
      }
    });

    // Save auto-sync settings
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime("now"))');
    stmt.run('autosync_enabled', 'true');
    stmt.run('autosync_time', time);

    console.log(`Auto-sync enabled for ${time} daily`);
  }

  disableAutoSync(): void {
    if (this.autoSyncJob) {
      this.autoSyncJob.cancel();
      this.autoSyncJob = null;
    }

    const stmt = db.prepare('DELETE FROM settings WHERE key IN (?, ?)');
    stmt.run('autosync_enabled', 'autosync_time');

    console.log('Auto-sync disabled');
  }

  private initializeAutoSync(): void {
    try {
      const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
      const enabledResult = stmt.get('autosync_enabled') as { value: string } | undefined;
      const timeResult = stmt.get('autosync_time') as { value: string } | undefined;

      if (enabledResult?.value === 'true' && timeResult?.value) {
        this.enableAutoSync(timeResult.value);
      }
    } catch (error) {
      // Settings not available yet
    }
  }

  getAutoSyncStatus(): { enabled: boolean; time?: string } {
    try {
      const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
      const enabledResult = stmt.get('autosync_enabled') as { value: string } | undefined;
      const timeResult = stmt.get('autosync_time') as { value: string } | undefined;

      return {
        enabled: enabledResult?.value === 'true',
        time: timeResult?.value
      };
    } catch (error) {
      return { enabled: false };
    }
  }

  async fetchDailySummary(date: string): Promise<GarminData | null> {
    if (!this.isAuthenticated) {
      // Try auto-retry if we have stored credentials
      if (this.hasStoredCredentials()) {
        const success = await this.loginWithRetry();
        if (!success) {
          throw new Error('Not authenticated with Garmin Connect. Please log in first.');
        }
      } else {
        throw new Error('Not authenticated with Garmin Connect. Please log in first.');
      }
    }

    try {
      // Parse the date string (expected format: YYYY-MM-DD)
      const [year, month, day] = date.split('-').map(Number);

      // Get sleep data
      const sleepData = await this.garminClient.getSleep(new Date(year, month - 1, day));

      // Get daily stats
      const dailyStats = await this.garminClient.getDailySummaryChart(new Date(year, month - 1, day));

      // Get heart rate data
      const heartRate = await this.garminClient.getHeartRate(new Date(year, month - 1, day));

      // Calculate sleep quality from sleep data
      const sleepQuality = this.calculateSleepQuality(sleepData);

      const data: GarminData = {
        date,
        sleepHours: sleepData?.dailySleepDTO?.sleepTimeSeconds ? sleepData.dailySleepDTO.sleepTimeSeconds / 3600 : undefined,
        sleepQuality,
        steps: dailyStats?.totalSteps || undefined,
        heartRateAvg: heartRate?.heartRateValues ? this.calculateAvgHeartRate(heartRate.heartRateValues) : undefined,
        heartRateResting: heartRate?.restingHeartRate || undefined,
        stressLevel: dailyStats?.avgStressLevel || undefined,
        energyLevel: dailyStats?.maxStress ? 100 - dailyStats.maxStress : undefined, // Inverse of stress as a proxy
        caloriesBurned: dailyStats?.totalKilocalories || undefined,
        activeMinutes: dailyStats?.activeTimeInMinutes || undefined
      };

      return data;
    } catch (error) {
      console.error('Error fetching Garmin data:', error);
      this.isAuthenticated = false; // Mark as unauthenticated on fetch failure
      throw new Error('Failed to fetch data from Garmin Connect. You may need to log in again.');
    }
  }

  private calculateAvgHeartRate(heartRateValues: any[]): number | undefined {
    if (!heartRateValues || heartRateValues.length === 0) return undefined;

    const validValues = heartRateValues.filter(v => v && typeof v === 'number' && v > 0);
    if (validValues.length === 0) return undefined;

    const sum = validValues.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / validValues.length);
  }

  private calculateSleepQuality(sleepData: any): number | undefined {
    if (!sleepData?.dailySleepDTO) return undefined;

    const sleep = sleepData.dailySleepDTO;
    const totalSleep = sleep.sleepTimeSeconds || 0;

    if (totalSleep === 0) return undefined;

    let quality = 100;

    // Check deep sleep percentage (ideal 15-25%)
    if (sleep.deepSleepSeconds) {
      const deepSleepPercent = sleep.deepSleepSeconds / totalSleep;
      if (deepSleepPercent < 0.15 || deepSleepPercent > 0.25) {
        quality -= 20;
      }
    }

    // Check REM sleep percentage (ideal 20-25%)
    if (sleep.remSleepSeconds) {
      const remSleepPercent = sleep.remSleepSeconds / totalSleep;
      if (remSleepPercent < 0.20 || remSleepPercent > 0.25) {
        quality -= 15;
      }
    }

    // Penalize for awake time
    if (sleep.awakeSleepSeconds) {
      quality -= Math.min(30, (sleep.awakeSleepSeconds / 3600) * 10);
    }

    // Bonus for good sleep duration (7-9 hours)
    const sleepHours = totalSleep / 3600;
    if (sleepHours >= 7 && sleepHours <= 9) {
      quality += 10;
    }

    return Math.max(0, Math.min(100, quality));
  }

  async syncData(date: string): Promise<void> {
    const data = await this.fetchDailySummary(date);

    if (data) {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO garmin_data
        (date, sleep_hours, sleep_quality, steps, heart_rate_avg, heart_rate_resting,
         stress_level, energy_level, calories_burned, active_minutes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        data.date,
        data.sleepHours,
        data.sleepQuality,
        data.steps,
        data.heartRateAvg,
        data.heartRateResting,
        data.stressLevel,
        data.energyLevel,
        data.caloriesBurned,
        data.activeMinutes
      );
    }
  }

  async syncDateRange(startDate: string, endDate: string): Promise<number> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let syncedDays = 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      try {
        await this.syncData(dateStr);
        syncedDays++;
        console.log(`Synced data for ${dateStr}`);
      } catch (error) {
        console.error(`Failed to sync ${dateStr}:`, error);
      }
    }

    return syncedDays;
  }

  // Manual data entry for testing or when API is not available
  manualEntry(data: GarminData): void {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO garmin_data
      (date, sleep_hours, sleep_quality, steps, heart_rate_avg, heart_rate_resting,
       stress_level, energy_level, calories_burned, active_minutes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      data.date,
      data.sleepHours || null,
      data.sleepQuality || null,
      data.steps || null,
      data.heartRateAvg || null,
      data.heartRateResting || null,
      data.stressLevel || null,
      data.energyLevel || null,
      data.caloriesBurned || null,
      data.activeMinutes || null
    );
  }

  getDataByDateRange(startDate: string, endDate: string) {
    const stmt = db.prepare(`
      SELECT * FROM garmin_data
      WHERE date BETWEEN ? AND ?
      ORDER BY date DESC
    `);
    return stmt.all(startDate, endDate);
  }
}

export default new GarminService();
