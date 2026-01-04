import db from '../database';
import { subDays, format, parseISO } from 'date-fns';

export interface Correlation {
  trigger: string;
  effect: string;
  score: number;
  sampleSize: number;
  description: string;
}

export class AnalyticsService {
  // Analyze correlation between habits and sleep quality
  analyzeHabitImpact(habitType: string, days: number = 30): Correlation[] {
    const endDate = format(new Date(), 'yyyy-MM-dd');
    const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');

    // Get all dates with the habit
    const habitsStmt = db.prepare(`
      SELECT DISTINCT date, time FROM habits
      WHERE habit_type = ? AND date BETWEEN ? AND ?
    `);
    const habitDates = habitsStmt.all(habitType, startDate, endDate) as Array<{date: string, time: string}>;

    // Categorize by time of day (morning, afternoon, evening, late night)
    const timeCategories = {
      late_evening: habitDates.filter(h => this.getHourFromTime(h.time) >= 18),
      afternoon: habitDates.filter(h => this.getHourFromTime(h.time) >= 12 && this.getHourFromTime(h.time) < 18),
      morning: habitDates.filter(h => this.getHourFromTime(h.time) < 12)
    };

    const correlations: Correlation[] = [];

    // Analyze late evening habits impact on sleep
    if (timeCategories.late_evening.length > 0) {
      const sleepCorrelation = this.calculateSleepCorrelation(
        timeCategories.late_evening.map(h => h.date),
        startDate,
        endDate
      );

      if (sleepCorrelation.sampleSize >= 3) {
        correlations.push({
          trigger: `${habitType} after 6 PM`,
          effect: 'sleep_quality',
          score: sleepCorrelation.impact,
          sampleSize: sleepCorrelation.sampleSize,
          description: this.generateDescription(
            `${habitType} after 6 PM`,
            'sleep quality',
            sleepCorrelation.impact,
            sleepCorrelation.avgWithHabit,
            sleepCorrelation.avgWithoutHabit
          )
        });
      }
    }

    // Analyze impact on next day energy
    const energyCorrelation = this.calculateEnergyCorrelation(
      habitDates.map(h => h.date),
      startDate,
      endDate
    );

    if (energyCorrelation.sampleSize >= 3) {
      correlations.push({
        trigger: habitType,
        effect: 'next_day_energy',
        score: energyCorrelation.impact,
        sampleSize: energyCorrelation.sampleSize,
        description: this.generateDescription(
          habitType,
          'next day energy',
          energyCorrelation.impact,
          energyCorrelation.avgWithHabit,
          energyCorrelation.avgWithoutHabit
        )
      });
    }

    return correlations;
  }

  // Analyze food timing impact on sleep and energy
  analyzeFoodTiming(days: number = 30): Correlation[] {
    const endDate = format(new Date(), 'yyyy-MM-dd');
    const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');

    const correlations: Correlation[] = [];

    // Find late eating patterns
    const lateMealsStmt = db.prepare(`
      SELECT date FROM food_logs
      WHERE date BETWEEN ? AND ?
      AND time >= '20:00'
      GROUP BY date
    `);
    const lateMealDates = (lateMealsStmt.all(startDate, endDate) as Array<{date: string}>)
      .map(r => r.date);

    if (lateMealDates.length >= 3) {
      const sleepCorrelation = this.calculateSleepCorrelation(lateMealDates, startDate, endDate);

      correlations.push({
        trigger: 'Late dinner (after 8 PM)',
        effect: 'sleep_quality',
        score: sleepCorrelation.impact,
        sampleSize: sleepCorrelation.sampleSize,
        description: this.generateDescription(
          'eating after 8 PM',
          'sleep quality',
          sleepCorrelation.impact,
          sleepCorrelation.avgWithHabit,
          sleepCorrelation.avgWithoutHabit
        )
      });
    }

    return correlations;
  }

  // Calculate correlation between habit dates and sleep quality
  private calculateSleepCorrelation(habitDates: string[], startDate: string, endDate: string) {
    const sleepStmt = db.prepare(`
      SELECT date, sleep_quality FROM garmin_data
      WHERE date BETWEEN ? AND ?
      AND sleep_quality IS NOT NULL
    `);
    const allSleep = sleepStmt.all(startDate, endDate) as Array<{date: string, sleep_quality: number}>;

    const sleepWithHabit = allSleep.filter(s => habitDates.includes(s.date));
    const sleepWithoutHabit = allSleep.filter(s => !habitDates.includes(s.date));

    const avgWithHabit = this.average(sleepWithHabit.map(s => s.sleep_quality));
    const avgWithoutHabit = this.average(sleepWithoutHabit.map(s => s.sleep_quality));

    // Impact score: negative means habit reduces sleep quality
    const impact = avgWithHabit - avgWithoutHabit;

    return {
      impact,
      avgWithHabit,
      avgWithoutHabit,
      sampleSize: Math.min(sleepWithHabit.length, sleepWithoutHabit.length)
    };
  }

  // Calculate correlation between habit and next day energy
  private calculateEnergyCorrelation(habitDates: string[], startDate: string, endDate: string) {
    const energyStmt = db.prepare(`
      SELECT date, energy_level FROM garmin_data
      WHERE date BETWEEN ? AND ?
      AND energy_level IS NOT NULL
    `);
    const allEnergy = energyStmt.all(startDate, endDate) as Array<{date: string, energy_level: number}>;

    // Get energy for day AFTER habit
    const energyAfterHabit = allEnergy.filter(e => {
      const prevDay = format(subDays(parseISO(e.date), 1), 'yyyy-MM-dd');
      return habitDates.includes(prevDay);
    });

    const energyWithoutHabit = allEnergy.filter(e => {
      const prevDay = format(subDays(parseISO(e.date), 1), 'yyyy-MM-dd');
      return !habitDates.includes(prevDay);
    });

    const avgWithHabit = this.average(energyAfterHabit.map(e => e.energy_level));
    const avgWithoutHabit = this.average(energyWithoutHabit.map(e => e.energy_level));

    const impact = avgWithHabit - avgWithoutHabit;

    return {
      impact,
      avgWithHabit,
      avgWithoutHabit,
      sampleSize: Math.min(energyAfterHabit.length, energyWithoutHabit.length)
    };
  }

  // Get comprehensive insights for a date range
  getAllInsights(days: number = 30): Correlation[] {
    const correlations: Correlation[] = [];

    // Get unique habit types
    const habitTypesStmt = db.prepare(`
      SELECT DISTINCT habit_type FROM habits
      WHERE date >= date('now', '-${days} days')
    `);
    const habitTypes = habitTypesStmt.all() as Array<{habit_type: string}>;

    // Analyze each habit type
    habitTypes.forEach(({ habit_type }) => {
      const habitCorrelations = this.analyzeHabitImpact(habit_type, days);
      correlations.push(...habitCorrelations);
    });

    // Analyze food timing
    const foodCorrelations = this.analyzeFoodTiming(days);
    correlations.push(...foodCorrelations);

    // Sort by absolute impact score
    return correlations.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  }

  // Store insight in database
  saveInsight(correlation: Correlation) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO insights
      (insight_type, trigger, effect, correlation_score, sample_size, description, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    stmt.run(
      'correlation',
      correlation.trigger,
      correlation.effect,
      correlation.score,
      correlation.sampleSize,
      correlation.description
    );
  }

  // Helper functions
  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  private getHourFromTime(time: string): number {
    return parseInt(time.split(':')[0]);
  }

  private generateDescription(
    trigger: string,
    effect: string,
    impact: number,
    avgWith: number,
    avgWithout: number
  ): string {
    const direction = impact > 0 ? 'improves' : 'reduces';
    const magnitude = Math.abs(impact);
    const percentage = ((magnitude / avgWithout) * 100).toFixed(1);

    return `${trigger} ${direction} ${effect} by ${magnitude.toFixed(1)} points (${percentage}%). ` +
           `Average with: ${avgWith.toFixed(1)}, without: ${avgWithout.toFixed(1)}.`;
  }
}

export default new AnalyticsService();
