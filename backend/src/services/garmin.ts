import { GarminConnect } from 'garmin-connect';
import db from '../database';

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

export class GarminService {
  private garminClient: GarminConnect;
  private isAuthenticated: boolean = false;

  constructor() {
    this.garminClient = new GarminConnect({
      username: '',
      password: ''
    });
    this.loadSession();
  }

  private loadSession() {
    try {
      const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
      const result = stmt.get('garmin_session') as { value: string } | undefined;
      if (result?.value) {
        // Session data exists, but we'll need to re-authenticate since garmin-connect
        // doesn't persist sessions easily. User will need to log in again.
        this.isAuthenticated = false;
      }
    } catch (error) {
      // Database table might not exist yet during initialization
      this.isAuthenticated = false;
    }
  }

  async login(username: string, password: string): Promise<void> {
    try {
      this.garminClient = new GarminConnect({
        username,
        password
      });

      await this.garminClient.login();
      this.isAuthenticated = true;

      // Store session indicator
      const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime("now"))');
      stmt.run('garmin_session', 'active');

      console.log('Successfully logged in to Garmin Connect');
    } catch (error) {
      this.isAuthenticated = false;
      console.error('Garmin login failed:', error);
      throw new Error('Failed to authenticate with Garmin Connect. Please check your credentials.');
    }
  }

  isLoggedIn(): boolean {
    return this.isAuthenticated;
  }

  logout(): void {
    this.isAuthenticated = false;
    const stmt = db.prepare('DELETE FROM settings WHERE key = ?');
    stmt.run('garmin_session');
  }

  async fetchDailySummary(date: string): Promise<GarminData | null> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated with Garmin Connect. Please log in first.');
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
