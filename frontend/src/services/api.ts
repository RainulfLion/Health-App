import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

export interface GarminData {
  id?: number;
  date: string;
  sleep_hours?: number;
  sleep_quality?: number;
  steps?: number;
  heart_rate_avg?: number;
  heart_rate_resting?: number;
  stress_level?: number;
  energy_level?: number;
  calories_burned?: number;
  active_minutes?: number;
}

export interface FoodLog {
  id?: number;
  date: string;
  time: string;
  food_name: string;
  calories?: number;
  image_path?: string;
  notes?: string;
  tags?: string;
}

export interface Habit {
  id?: number;
  date: string;
  time: string;
  habit_type: string;
  description?: string;
  intensity?: number;
}

export interface Insight {
  trigger: string;
  effect: string;
  score: number;
  sampleSize: number;
  description: string;
}

export interface DashboardData {
  period: string;
  health: {
    avg_sleep: number;
    avg_sleep_quality: number;
    avg_steps: number;
    avg_energy: number;
    avg_stress: number;
  };
  nutrition: {
    total_meals: number;
    avg_calories_per_meal: number;
    avg_daily_calories: number;
  };
  habits: Array<{ habit_type: string; count: number }>;
  topInsights: Insight[];
}

// Garmin endpoints
export const garminAPI = {
  login: (username: string, password: string, saveCredentials?: boolean) =>
    api.post('/garmin/login', { username, password, saveCredentials }),
  logout: () => api.post('/garmin/logout'),
  getStatus: () => api.get<{
    isLoggedIn: boolean;
    hasStoredCredentials: boolean;
    autoSync: { enabled: boolean; time?: string };
  }>('/garmin/status'),
  clearCredentials: () => api.post('/garmin/clear-credentials'),
  enableAutoSync: (time: string) => api.post('/garmin/autosync/enable', { time }),
  disableAutoSync: () => api.post('/garmin/autosync/disable'),
  getAutoSyncStatus: () => api.get<{ enabled: boolean; time?: string }>('/garmin/autosync/status'),
  sync: (date?: string) => api.post('/garmin/sync', { date }),
  syncRange: (days: number) => api.post('/garmin/sync-range', { days }),
  manualEntry: (data: GarminData) => api.post('/garmin/manual', data),
  getData: (startDate?: string, endDate?: string) =>
    api.get<GarminData[]>('/garmin/data', { params: { startDate, endDate } })
};

// Food endpoints
export const foodAPI = {
  create: (formData: FormData) =>
    api.post<{ message: string; id: number; imagePath?: string }>('/food', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  getAll: (startDate?: string, endDate?: string) =>
    api.get<FoodLog[]>('/food', { params: { startDate, endDate } }),
  getByDate: (date: string) => api.get<FoodLog[]>(`/food/date/${date}`),
  update: (id: number, data: Partial<FoodLog>) => api.put(`/food/${id}`, data),
  delete: (id: number) => api.delete(`/food/${id}`),
  getDailyCalories: (startDate?: string, endDate?: string) =>
    api.get('/food/calories/daily', { params: { startDate, endDate } })
};

// Habits endpoints
export const habitsAPI = {
  create: (data: Habit) => api.post<{ message: string; id: number }>('/habits', data),
  getAll: (startDate?: string, endDate?: string) =>
    api.get<Habit[]>('/habits', { params: { startDate, endDate } }),
  getByDate: (date: string) => api.get<Habit[]>(`/habits/date/${date}`),
  getTypes: () => api.get<Array<{ habit_type: string }>>('/habits/types'),
  update: (id: number, data: Partial<Habit>) => api.put(`/habits/${id}`, data),
  delete: (id: number) => api.delete(`/habits/${id}`)
};

// Analytics endpoints
export const analyticsAPI = {
  getInsights: (days?: number) =>
    api.get<Insight[]>('/analytics/insights', { params: { days } }),
  getHabitAnalysis: (habitType: string, days?: number) =>
    api.get<Insight[]>(`/analytics/habit/${habitType}`, { params: { days } }),
  getFoodTiming: (days?: number) =>
    api.get<Insight[]>('/analytics/food-timing', { params: { days } }),
  getSaved: () => api.get('/analytics/saved'),
  getDashboard: (days?: number) =>
    api.get<DashboardData>('/analytics/dashboard', { params: { days } })
};

export default api;
