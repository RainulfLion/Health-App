import { useState, useEffect } from 'react';
import { garminAPI, GarminData } from '../services/api';
import { format, subDays } from 'date-fns';
import { Download, Plus, Activity, LogIn, LogOut } from 'lucide-react';

function GarminSync() {
  const [garminData, setGarminData] = useState<GarminData[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [loginData, setLoginData] = useState({
    username: '',
    password: ''
  });

  const [manualData, setManualData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    sleep_hours: '',
    sleep_quality: '',
    steps: '',
    heart_rate_avg: '',
    energy_level: '',
    stress_level: ''
  });

  useEffect(() => {
    checkLoginStatus();
    loadData();
  }, []);

  const checkLoginStatus = async () => {
    try {
      const response = await garminAPI.getStatus();
      setIsLoggedIn(response.data.isLoggedIn);
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsLoggedIn(false);
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await garminAPI.login(loginData.username, loginData.password);
      setIsLoggedIn(true);
      setShowLoginForm(false);
      setMessage({ type: 'success', text: 'Successfully logged in to Garmin Connect!' });
      setLoginData({ username: '', password: '' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Login failed. Please check your credentials.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await garminAPI.logout();
      setIsLoggedIn(false);
      setMessage({ type: 'success', text: 'Logged out successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await garminAPI.getData();
      setGarminData(response.data);
    } catch (error) {
      console.error('Error loading Garmin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (days: number = 7) => {
    try {
      setSyncing(true);
      await garminAPI.syncRange(days);
      setMessage({ type: 'success', text: `Successfully synced ${days} days of data!` });
      loadData();
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to sync. Please log in first.'
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();

    const data: GarminData = {
      date: manualData.date,
      sleep_hours: manualData.sleep_hours ? parseFloat(manualData.sleep_hours) : undefined,
      sleep_quality: manualData.sleep_quality ? parseInt(manualData.sleep_quality) : undefined,
      steps: manualData.steps ? parseInt(manualData.steps) : undefined,
      heart_rate_avg: manualData.heart_rate_avg ? parseInt(manualData.heart_rate_avg) : undefined,
      energy_level: manualData.energy_level ? parseInt(manualData.energy_level) : undefined,
      stress_level: manualData.stress_level ? parseInt(manualData.stress_level) : undefined
    };

    try {
      await garminAPI.manualEntry(data);
      setMessage({ type: 'success', text: 'Health data saved successfully!' });
      setShowManualEntry(false);
      setManualData({
        date: format(new Date(), 'yyyy-MM-dd'),
        sleep_hours: '',
        sleep_quality: '',
        steps: '',
        heart_rate_avg: '',
        energy_level: '',
        stress_level: ''
      });
      loadData();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save health data' });
    }
  };

  return (
    <div className="container">
      <h1>Garmin Data Sync</h1>

      {message && (
        <div className={message.type}>{message.text}</div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Garmin Connect</h2>
          {!checkingAuth && (
            isLoggedIn ? (
              <button className="btn btn-secondary" onClick={handleLogout}>
                <LogOut size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                Logout
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => setShowLoginForm(!showLoginForm)}>
                <LogIn size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                {showLoginForm ? 'Cancel' : 'Login'}
              </button>
            )
          )}
        </div>

        {checkingAuth ? (
          <div className="loading">Checking authentication...</div>
        ) : isLoggedIn ? (
          <>
            <p style={{ color: '#22c55e', marginBottom: '1.5rem', fontWeight: '500' }}>
              ✓ Connected to Garmin Connect
            </p>

            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
                Automatically sync your sleep, activity, steps, heart rate, and health metrics from Garmin Connect.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={() => handleSync(7)}
                disabled={syncing}
              >
                <Download size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                {syncing ? 'Syncing...' : 'Sync Last 7 Days'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleSync(30)}
                disabled={syncing}
              >
                <Download size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                {syncing ? 'Syncing...' : 'Sync Last 30 Days'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
              Connect your Garmin account to automatically sync health data from your Garmin watch.
            </p>

            {showLoginForm && (
              <form onSubmit={handleLogin} style={{ marginTop: '1.5rem' }}>
                <div className="form-group">
                  <label>Garmin Connect Email</label>
                  <input
                    type="email"
                    value={loginData.username}
                    onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                    placeholder="your.email@example.com"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    placeholder="Your Garmin Connect password"
                    required
                  />
                </div>

                <div style={{ backgroundColor: '#fef3c7', border: '1px solid #fbbf24', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                  <p style={{ fontSize: '0.875rem', color: '#92400e', margin: 0 }}>
                    <strong>Note:</strong> Your credentials are used only to authenticate with Garmin and are not stored permanently.
                    You'll need to log in again when you restart the app.
                  </p>
                </div>

                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Logging in...' : 'Login to Garmin Connect'}
                </button>
              </form>
            )}
          </>
        )}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Manual Entry</h2>
          <button className="btn btn-primary" onClick={() => setShowManualEntry(!showManualEntry)}>
            <Plus size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
            {showManualEntry ? 'Cancel' : 'Add Entry'}
          </button>
        </div>

        <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
          Don't have a Garmin watch? Manually enter your health data from other sources.
        </p>

        {showManualEntry && (
          <form onSubmit={handleManualEntry}>
            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={manualData.date}
                onChange={(e) => setManualData({ ...manualData, date: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-2">
              <div className="form-group">
                <label>Sleep Hours</label>
                <input
                  type="number"
                  step="0.1"
                  value={manualData.sleep_hours}
                  onChange={(e) => setManualData({ ...manualData, sleep_hours: e.target.value })}
                  placeholder="e.g., 7.5"
                />
              </div>
              <div className="form-group">
                <label>Sleep Quality (0-100)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={manualData.sleep_quality}
                  onChange={(e) => setManualData({ ...manualData, sleep_quality: e.target.value })}
                  placeholder="e.g., 85"
                />
              </div>
            </div>

            <div className="grid grid-2">
              <div className="form-group">
                <label>Steps</label>
                <input
                  type="number"
                  value={manualData.steps}
                  onChange={(e) => setManualData({ ...manualData, steps: e.target.value })}
                  placeholder="e.g., 10000"
                />
              </div>
              <div className="form-group">
                <label>Average Heart Rate</label>
                <input
                  type="number"
                  value={manualData.heart_rate_avg}
                  onChange={(e) => setManualData({ ...manualData, heart_rate_avg: e.target.value })}
                  placeholder="e.g., 72"
                />
              </div>
            </div>

            <div className="grid grid-2">
              <div className="form-group">
                <label>Energy Level (0-100)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={manualData.energy_level}
                  onChange={(e) => setManualData({ ...manualData, energy_level: e.target.value })}
                  placeholder="e.g., 75"
                />
              </div>
              <div className="form-group">
                <label>Stress Level (0-100)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={manualData.stress_level}
                  onChange={(e) => setManualData({ ...manualData, stress_level: e.target.value })}
                  placeholder="e.g., 35"
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary">Save Health Data</button>
          </form>
        )}
      </div>

      <div className="card">
        <h2>
          <Activity size={24} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
          Recent Health Data
        </h2>
        {loading ? (
          <div className="loading">Loading...</div>
        ) : garminData.length === 0 ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
            No health data yet. Sync your Garmin or add a manual entry to get started.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem' }}>Date</th>
                  <th style={{ padding: '0.75rem' }}>Sleep</th>
                  <th style={{ padding: '0.75rem' }}>Quality</th>
                  <th style={{ padding: '0.75rem' }}>Steps</th>
                  <th style={{ padding: '0.75rem' }}>Energy</th>
                  <th style={{ padding: '0.75rem' }}>Stress</th>
                </tr>
              </thead>
              <tbody>
                {garminData.map((data, index) => (
                  <tr key={data.id || index} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.75rem' }}>{data.date}</td>
                    <td style={{ padding: '0.75rem' }}>
                      {data.sleep_hours ? `${data.sleep_hours.toFixed(1)}h` : '-'}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {data.sleep_quality ? `${data.sleep_quality}/100` : '-'}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {data.steps ? data.steps.toLocaleString() : '-'}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {data.energy_level ? `${data.energy_level}/100` : '-'}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {data.stress_level ? `${data.stress_level}/100` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default GarminSync;
