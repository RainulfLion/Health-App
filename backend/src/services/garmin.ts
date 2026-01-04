import axios from 'axios';
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
  private accessToken: string | null = null;

  constructor() {
    this.loadToken();
  }

  private loadToken() {
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    const result = stmt.get('garmin_access_token') as { value: string } | undefined;
    this.accessToken = result?.value || null;
  }

  setAccessToken(token: string) {
    this.accessToken = token;
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime("now"))');
    stmt.run('garmin_access_token', token);
  }

  async fetchDailySummary(date: string): Promise<GarminData | null> {
    if (!this.accessToken) {
      throw new Error('Garmin access token not configured');
    }

    try {
      // Note: This is a placeholder for actual Garmin API endpoints
      // Garmin uses OAuth 1.0a and requires specific API endpoints
      // You'll need to register your app at https://developer.garmin.com/

      const baseUrl = 'https://apis.garmin.com/wellness-api/rest';

      // Fetch sleep data
      const sleepResponse = await axios.get(`${baseUrl}/dailies/${date}`, {
        headers: { 'Authorization': `Bearer ${this.accessToken}` }
      });

      // Transform Garmin API response to our format
      const data: GarminData = {
        date,
        sleepHours: sleepResponse.data.sleepTimeSeconds / 3600,
        sleepQuality: this.calculateSleepQuality(sleepResponse.data),
        steps: sleepResponse.data.totalSteps,
        heartRateAvg: sleepResponse.data.averageHeartRateInBeatsPerMinute,
        heartRateResting: sleepResponse.data.restingHeartRateInBeatsPerMinute,
        stressLevel: sleepResponse.data.averageStressLevel,
        energyLevel: sleepResponse.data.bodyBatteryHighestValue,
        caloriesBurned: sleepResponse.data.totalKilocalories,
        activeMinutes: sleepResponse.data.vigorousIntensityDurationInSeconds / 60 +
                      sleepResponse.data.moderateIntensityDurationInSeconds / 60
      };

      return data;
    } catch (error) {
      console.error('Error fetching Garmin data:', error);
      return null;
    }
  }

  private calculateSleepQuality(sleepData: any): number {
    // Calculate sleep quality score (0-100) based on sleep stages
    const deepSleep = sleepData.deepSleepDurationInSeconds / sleepData.sleepTimeSeconds;
    const remSleep = sleepData.remSleepDurationInSeconds / sleepData.sleepTimeSeconds;
    const awakeDuration = sleepData.awakeDurationInSeconds;

    let quality = 100;

    // Ideal deep sleep is 15-25% of total sleep
    if (deepSleep < 0.15 || deepSleep > 0.25) quality -= 20;

    // Ideal REM sleep is 20-25% of total sleep
    if (remSleep < 0.20 || remSleep > 0.25) quality -= 15;

    // Penalize for awake time
    quality -= Math.min(30, (awakeDuration / 3600) * 10);

    return Math.max(0, quality);
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
