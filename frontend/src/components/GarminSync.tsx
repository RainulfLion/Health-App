import { useState, useEffect } from 'react';
import { garminAPI, GarminData } from '../services/api';
import { format, subDays } from 'date-fns';
import { Download, Plus, Activity, LogIn, LogOut, Clock, Shield } from 'lucide-react';

function GarminSync() {
  const [garminData, setGarminData] = useState<GarminData[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasStoredCredentials, setHasStoredCredentials] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [autoSyncTime, setAutoSyncTime] = useState('06:00');
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [showAutoSync, setShowAutoSync] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const [loginData, setLoginData] = useState({
    username: '',
    password: '',
    saveCredentials: false
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
      setHasStoredCredentials(response.data.hasStoredCredentials);
      setAutoSyncEnabled(response.data.autoSync.enabled);
      setAutoSyncTime(response.data.autoSync.time || '06:00');
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
      await garminAPI.login(loginData.username, loginData.password, loginData.saveCredentials);
      setIsLoggedIn(true);
      setHasStoredCredentials(loginData.saveCredentials);
      setShowLoginForm(false);

      const successMsg = loginData.saveCredentials
        ? 'Successfully logged in! Credentials saved for auto-sync.'
        : 'Successfully logged in to Garmin Connect!';

      setMessage({ type: 'success', text: successMsg });
      setLoginData({ username: '', password: '', saveCredentials: false });
      setTimeout(() => setMessage(null), 5000);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Login failed. Please check your credentials.';

      if (errorMsg.includes('CAPTCHA')) {
        setMessage({
          type: 'error',
          text: 'CAPTCHA detected! Enable "Save credentials" and the app will auto-retry login when CAPTCHA is not present.'
        });
      } else {
        setMessage({ type: 'error', text: errorMsg });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await garminAPI.logout();
      setIsLoggedIn(false);
      setHasStoredCredentials(false);
      setAutoSyncEnabled(false);
      setMessage({ type: 'success', text: 'Logged out successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleClearCredentials = async () => {
    if (!confirm('Are you sure you want to clear saved credentials? Auto-sync will stop working.')) {
      return;
    }

    try {
      await garminAPI.clearCredentials();
      setHasStoredCredentials(false);
      setMessage({ type: 'info', text: 'Stored credentials cleared' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error clearing credentials:', error);
    }
  };

  const handleToggleAutoSync = async () => {
    try {
      if (autoSyncEnabled) {
        await garminAPI.disableAutoSync();
        setAutoSyncEnabled(false);
        setMessage({ type: 'info', text: 'Auto-sync disabled' });
      } else {
        if (!hasStoredCredentials) {
          setMessage({
            type: 'error',
            text: 'Please log in with "Save credentials" enabled to use auto-sync'
          });
          return;
        }

        await garminAPI.enableAutoSync(autoSyncTime);
        setAutoSyncEnabled(true);
        setMessage({ type: 'success', text: `Auto-sync enabled for ${autoSyncTime} daily` });
      }
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error toggling auto-sync:', error);
    }
  };

  const handleAutoSyncTimeChange = async (newTime: string) => {
    setAutoSyncTime(newTime);

    if (autoSyncEnabled) {
      try {
        await garminAPI.enableAutoSync(newTime);
        setMessage({ type: 'success', text: `Auto-sync time updated to ${newTime}` });
        setTimeout(() => setMessage(null), 3000);
      } catch (error) {
        console.error('Error updating auto-sync time:', error);
      }
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
      sleepHours: manualData.sleep_hours ? parseFloat(manualData.sleep_hours) : undefined,
      sleepQuality: manualData.sleep_quality ? parseInt(manualData.sleep_quality) : undefined,
      steps: manualData.steps ? parseInt(manualData.steps) : undefined,
      heartRateAvg: manualData.heart_rate_avg ? parseInt(manualData.heart_rate_avg) : undefined,
      energyLevel: manualData.energy_level ? parseInt(manualData.energy_level) : undefined,
      stressLevel: manualData.stress_level ? parseInt(manualData.stress_level) : undefined
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
        <div className={message.type} style={{ marginBottom: '1rem' }}>
          {message.text}
        </div>
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

            {hasStoredCredentials && (
              <div style={{ backgroundColor: '#dbeafe', border: '1px solid: #3b82f6', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Shield size={20} style={{ color: '#3b82f6' }} />
                    <span style={{ fontSize: '0.875rem', color: '#1e40af' }}>
                      Credentials saved for auto-retry
                    </span>
                  </div>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}
                    onClick={handleClearCredentials}
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
                Automatically sync your sleep, activity, steps, heart rate, and health metrics from Garmin Connect.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
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

            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem', marginTop: '1rem' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowAutoSync(!showAutoSync)}
                style={{ width: '100%' }}
              >
                <Clock size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                {showAutoSync ? 'Hide' : 'Configure'} Auto-Sync
              </button>

              {showAutoSync && (
                <div style={{ marginTop: '1rem', backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '8px' }}>
                  <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Automatic Daily Sync</h3>
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    Enable auto-sync to automatically pull your Garmin data every day at a specific time.
                    {!hasStoredCredentials && <strong> Requires saved credentials.</strong>}
                  </p>

                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={autoSyncEnabled}
                        onChange={handleToggleAutoSync}
                        disabled={!hasStoredCredentials}
                      />
                      <span>Enable Auto-Sync</span>
                    </label>

                    {autoSyncEnabled && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <label>Time:</label>
                        <input
                          type="time"
                          value={autoSyncTime}
                          onChange={(e) => handleAutoSyncTimeChange(e.target.value)}
                          style={{ padding: '0.25rem 0.5rem' }}
                        />
                      </div>
                    )}
                  </div>

                  {autoSyncEnabled && (
                    <p style={{ color: '#059669', fontSize: '0.875rem', fontWeight: '500' }}>
                      ✓ Auto-sync active: Data will sync daily at {autoSyncTime}
                    </p>
                  )}
                </div>
              )}
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

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={loginData.saveCredentials}
                      onChange={(e) => setLoginData({ ...loginData, saveCredentials: e.target.checked })}
                    />
                    <span>Save credentials for auto-sync and auto-retry</span>
                  </label>
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem', marginLeft: '1.5rem' }}>
                    Encrypted and stored locally. Enables automatic daily sync and retry on CAPTCHA.
                  </p>
                </div>

                <div style={{ backgroundColor: '#fef3c7', border: '1px solid #fbbf24', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                  <p style={{ fontSize: '0.875rem', color: '#92400e', margin: 0 }}>
                    <strong>Note:</strong> Garmin may show CAPTCHA on first login. If you enable "Save credentials",
                    the app will automatically retry throughout the day when CAPTCHA is not present. Auto-sync will work reliably after the first successful login.
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
