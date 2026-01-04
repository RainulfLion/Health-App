import { useState, useEffect } from 'react';
import { analyticsAPI, DashboardData } from '../services/api';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, Moon, TrendingUp, Utensils } from 'lucide-react';

function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    loadDashboard();
  }, [days]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const response = await analyticsAPI.getDashboard(days);
      setData(response.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="container loading">Loading dashboard...</div>;
  }

  if (!data) {
    return (
      <div className="container">
        <div className="card">
          <h2>Welcome to Health Tracker</h2>
          <p>Start logging your food, habits, and sync your Garmin data to see insights here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Dashboard</h1>
        <div>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #e5e7eb' }}
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="stat-card">
          <div className="label">
            <Moon size={20} style={{ display: 'inline', marginRight: '0.5rem' }} />
            Average Sleep
          </div>
          <div className="value">
            {data.health.avg_sleep?.toFixed(1) || 'N/A'}
            <span className="unit">hrs</span>
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
            Quality: {data.health.avg_sleep_quality?.toFixed(0) || 'N/A'}/100
          </div>
        </div>

        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
          <div className="label">
            <Activity size={20} style={{ display: 'inline', marginRight: '0.5rem' }} />
            Average Steps
          </div>
          <div className="value">
            {data.health.avg_steps?.toLocaleString() || 'N/A'}
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
            Energy: {data.health.avg_energy?.toFixed(0) || 'N/A'}/100
          </div>
        </div>

        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
          <div className="label">
            <Utensils size={20} style={{ display: 'inline', marginRight: '0.5rem' }} />
            Daily Calories
          </div>
          <div className="value">
            {data.nutrition.avg_daily_calories?.toFixed(0) || 'N/A'}
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
            {data.nutrition.total_meals} meals logged
          </div>
        </div>
      </div>

      {data.topInsights && data.topInsights.length > 0 && (
        <div className="card">
          <h2>
            <TrendingUp size={24} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
            Key Insights
          </h2>
          {data.topInsights.map((insight, index) => (
            <div
              key={index}
              className={`insight-card ${insight.score < 0 ? 'negative' : 'positive'}`}
            >
              <div className="trigger">{insight.trigger}</div>
              <div className="description">{insight.description}</div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                Based on {insight.sampleSize} samples
              </div>
            </div>
          ))}
        </div>
      )}

      {data.habits && data.habits.length > 0 && (
        <div className="card">
          <h3>Habit Frequency</h3>
          <div style={{ marginTop: '1rem' }}>
            {data.habits.map((habit, index) => (
              <div key={index} style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span>{habit.habit_type}</span>
                  <span style={{ fontWeight: '600' }}>{habit.count} times</span>
                </div>
                <div style={{ height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      backgroundColor: '#3b82f6',
                      width: `${(habit.count / Math.max(...data.habits.map(h => h.count))) * 100}%`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
