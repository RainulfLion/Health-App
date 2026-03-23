import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Bot, Send, Clock, Activity, Scale, Smile, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

interface BotStatus {
  active: boolean;
  chatId: string | null;
  checkinTime: string | null;
  tokenConfigured: boolean;
}

interface WeightLog {
  id: number;
  date: string;
  weight_kg: number;
  notes: string | null;
}

interface MoodLog {
  id: number;
  date: string;
  mood_score: number;
  notes: string | null;
}

interface Checkin {
  date: string;
  food_log: string | null;
  weight_kg: number | null;
  mood_score: number | null;
  mood_notes: string | null;
  completed: number;
}

export default function TelegramSetup() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [token, setToken] = useState('');
  const [checkinTime, setCheckinTime] = useState('08:00');
  const [days, setDays] = useState(30);
  const [weightData, setWeightData] = useState<WeightLog[]>([]);
  const [moodData, setMoodData] = useState<MoodLog[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<'setup' | 'charts' | 'history'>('setup');

  useEffect(() => {
    loadStatus();
    loadData();
  }, [days]);

  async function loadStatus() {
    try {
      const res = await axios.get('/api/telegram/status');
      setStatus(res.data);
      if (res.data.checkinTime) setCheckinTime(res.data.checkinTime);
    } catch {
      // ignore
    }
  }

  async function loadData() {
    try {
      const [weight, mood, checkinRes] = await Promise.all([
        axios.get(`/api/telegram/weight?days=${days}`),
        axios.get(`/api/telegram/mood?days=${days}`),
        axios.get(`/api/telegram/checkins?days=${days}`),
      ]);
      setWeightData(weight.data);
      setMoodData(mood.data);
      setCheckins(checkinRes.data);
    } catch {
      // ignore
    }
  }

  function showMessage(text: string, type: 'success' | 'error') {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }

  async function handleConfigure(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setLoading(true);
    try {
      await axios.post('/api/telegram/configure', { token: token.trim(), checkinTime });
      showMessage('Bot started successfully! Send /start to your bot on Telegram.', 'success');
      setToken('');
      await loadStatus();
    } catch (err: any) {
      showMessage(err.response?.data?.error || 'Failed to start bot', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleStop() {
    setLoading(true);
    try {
      await axios.post('/api/telegram/stop');
      showMessage('Bot stopped', 'success');
      await loadStatus();
    } catch {
      showMessage('Failed to stop bot', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateSchedule() {
    try {
      await axios.post('/api/telegram/schedule', { time: checkinTime });
      showMessage(`Daily check-in rescheduled to ${checkinTime}`, 'success');
    } catch {
      showMessage('Failed to update schedule', 'error');
    }
  }

  async function handleTriggerCheckin() {
    try {
      await axios.post('/api/telegram/checkin/trigger');
      showMessage('Check-in message sent to Telegram!', 'success');
    } catch (err: any) {
      showMessage(err.response?.data?.error || 'Failed to trigger check-in', 'error');
    }
  }

  // Merge weight and mood by date for combined chart
  const combinedDates = Array.from(
    new Set([...weightData.map(w => w.date), ...moodData.map(m => m.date)])
  ).sort();

  const combinedData = combinedDates.map(date => ({
    date: date.slice(5),
    weight: weightData.find(w => w.date === date)?.weight_kg ?? null,
    mood: moodData.find(m => m.date === date)?.mood_score ?? null,
  }));

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Bot size={28} className="text-blue-500" />
        <div>
          <h1 className="text-2xl font-bold">Telegram Health Bot</h1>
          <p className="text-gray-500 text-sm">Daily check-ins for food, weight & mood tracking</p>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {message.text}
        </div>
      )}

      {/* Status badge */}
      <div className="mb-6 flex items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
          status?.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
        }`}>
          <span className={`w-2 h-2 rounded-full ${status?.active ? 'bg-green-500' : 'bg-gray-400'}`} />
          {status?.active ? 'Bot Active' : 'Bot Inactive'}
        </span>
        {status?.chatId && (
          <span className="text-sm text-gray-500">Chat ID: {status.chatId}</span>
        )}
        {status?.checkinTime && (
          <span className="text-sm text-gray-500 flex items-center gap-1">
            <Clock size={13} /> Daily at {status.checkinTime}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b">
        {(['setup', 'charts', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* SETUP TAB */}
      {activeTab === 'setup' && (
        <div className="space-y-6">
          {/* How to get a bot token */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            <strong>Setup Instructions:</strong>
            <ol className="mt-2 ml-4 list-decimal space-y-1">
              <li>Open Telegram and search for <strong>@BotFather</strong></li>
              <li>Send <code>/newbot</code> and follow the prompts</li>
              <li>Copy the bot token BotFather gives you</li>
              <li>Paste it below and click "Start Bot"</li>
              <li>Open your new bot and send <strong>/start</strong> to register</li>
            </ol>
          </div>

          {/* Configure form */}
          {!status?.active ? (
            <form onSubmit={handleConfigure} className="bg-white border rounded-lg p-5 space-y-4">
              <h2 className="font-semibold text-gray-800">Configure Bot</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bot Token
                </label>
                <input
                  type="password"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Daily Check-in Time
                </label>
                <input
                  type="time"
                  value={checkinTime}
                  onChange={e => setCheckinTime(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                <Bot size={16} />
                {loading ? 'Starting...' : 'Start Bot'}
              </button>
            </form>
          ) : (
            <div className="bg-white border rounded-lg p-5 space-y-4">
              <h2 className="font-semibold text-gray-800">Bot Controls</h2>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleTriggerCheckin}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  <Send size={15} />
                  Send Check-in Now
                </button>
                <button
                  onClick={handleStop}
                  disabled={loading}
                  className="flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-200 disabled:opacity-50"
                >
                  <XCircle size={15} />
                  Stop Bot
                </button>
              </div>

              <div className="pt-2 border-t">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Change Check-in Time
                </label>
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={checkinTime}
                    onChange={e => setCheckinTime(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleUpdateSchedule}
                    className="flex items-center gap-2 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm hover:bg-gray-200"
                  >
                    <Clock size={14} /> Update
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Telegram commands reference */}
          <div className="bg-gray-50 border rounded-lg p-4 text-sm">
            <h3 className="font-semibold text-gray-700 mb-2">Bot Commands</h3>
            <ul className="space-y-1 text-gray-600">
              <li><code className="bg-white px-1 rounded">/start</code> — Register and start a check-in</li>
              <li><code className="bg-white px-1 rounded">/checkin</code> — Start today's health check-in</li>
              <li><code className="bg-white px-1 rounded">/summary [days]</code> — View charts & stats (default 30 days)</li>
              <li><code className="bg-white px-1 rounded">/history</code> — Show last 7 check-ins</li>
              <li><code className="bg-white px-1 rounded">/help</code> — Show all commands</li>
            </ul>
          </div>
        </div>
      )}

      {/* CHARTS TAB */}
      {activeTab === 'charts' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {[7, 14, 30, 90].map(d => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 py-1 rounded text-sm font-medium ${
                    days === d ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <button onClick={loadData} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border rounded-lg p-4">
              <div className="flex items-center gap-2 text-indigo-600 mb-1">
                <Scale size={16} /> <span className="text-sm font-medium">Weight</span>
              </div>
              {weightData.length > 0 ? (
                <>
                  <div className="text-2xl font-bold">
                    {weightData[weightData.length - 1].weight_kg} kg
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {weightData.length > 1 && (() => {
                      const diff = weightData[weightData.length - 1].weight_kg - weightData[0].weight_kg;
                      return (
                        <span className={diff < 0 ? 'text-green-600' : diff > 0 ? 'text-red-500' : 'text-gray-500'}>
                          {diff > 0 ? '+' : ''}{diff.toFixed(1)} kg over {days} days
                        </span>
                      );
                    })()}
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-400">No data yet</p>
              )}
            </div>

            <div className="bg-white border rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-600 mb-1">
                <Smile size={16} /> <span className="text-sm font-medium">Avg Mood</span>
              </div>
              {moodData.length > 0 ? (
                <>
                  <div className="text-2xl font-bold">
                    {(moodData.reduce((s, m) => s + m.mood_score, 0) / moodData.length).toFixed(1)}
                    <span className="text-sm text-gray-400 font-normal">/10</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{moodData.length} check-ins</div>
                </>
              ) : (
                <p className="text-sm text-gray-400">No data yet</p>
              )}
            </div>

            <div className="bg-white border rounded-lg p-4">
              <div className="flex items-center gap-2 text-orange-600 mb-1">
                <Activity size={16} /> <span className="text-sm font-medium">Check-ins</span>
              </div>
              <div className="text-2xl font-bold">{checkins.filter(c => c.completed).length}</div>
              <div className="text-xs text-gray-500 mt-1">of {days} days</div>
            </div>
          </div>

          {/* Weight chart */}
          {weightData.length > 1 ? (
            <div className="bg-white border rounded-lg p-4">
              <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Scale size={16} className="text-indigo-500" /> Weight Trend
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={weightData.map(w => ({ date: w.date.slice(5), weight: w.weight_kg }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} unit=" kg" />
                  <Tooltip formatter={(v: number) => [`${v} kg`, 'Weight']} />
                  <Line type="monotone" dataKey="weight" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="bg-gray-50 border rounded-lg p-8 text-center text-gray-400">
              <Scale size={32} className="mx-auto mb-2 opacity-40" />
              <p>Not enough weight data yet. Complete a few check-ins to see your trend.</p>
            </div>
          )}

          {/* Mood chart */}
          {moodData.length > 1 ? (
            <div className="bg-white border rounded-lg p-4">
              <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Smile size={16} className="text-green-500" /> Mood Trend
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={moodData.map(m => ({ date: m.date.slice(5), mood: m.mood_score }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[1, 10]} ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [`${v}/10`, 'Mood']} />
                  <Line type="monotone" dataKey="mood" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="bg-gray-50 border rounded-lg p-8 text-center text-gray-400">
              <Smile size={32} className="mx-auto mb-2 opacity-40" />
              <p>Not enough mood data yet. Complete a few check-ins to see your trend.</p>
            </div>
          )}

          {/* Combined chart */}
          {combinedData.length > 1 && weightData.length > 1 && moodData.length > 1 && (
            <div className="bg-white border rounded-lg p-4">
              <h3 className="font-semibold text-gray-700 mb-4">Weight & Mood Overview</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={combinedData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="weight" orientation="left" domain={['auto', 'auto']} tick={{ fontSize: 11 }} unit="kg" />
                  <YAxis yAxisId="mood" orientation="right" domain={[1, 10]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="weight" type="monotone" dataKey="weight" stroke="#6366f1" strokeWidth={2} dot={{ r: 2 }} name="Weight (kg)" connectNulls />
                  <Line yAxisId="mood" type="monotone" dataKey="mood" stroke="#22c55e" strokeWidth={2} dot={{ r: 2 }} name="Mood (/10)" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex gap-2 mb-2">
            {[7, 14, 30].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  days === d ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Last {d} days
              </button>
            ))}
          </div>

          {checkins.length === 0 ? (
            <div className="bg-gray-50 border rounded-lg p-8 text-center text-gray-400">
              <Bot size={32} className="mx-auto mb-2 opacity-40" />
              <p>No check-ins yet. Set up your bot and complete your first check-in!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {checkins.map(c => (
                <div key={c.date} className="bg-white border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-800">{c.date}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      c.completed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {c.completed ? 'Complete' : 'Partial'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    {c.food_log && (
                      <div>
                        <span className="text-gray-400 text-xs">Food</span>
                        <p className="text-gray-700 truncate">{c.food_log}</p>
                      </div>
                    )}
                    {c.weight_kg && (
                      <div>
                        <span className="text-gray-400 text-xs">Weight</span>
                        <p className="text-gray-700 font-medium">{c.weight_kg} kg</p>
                      </div>
                    )}
                    {c.mood_score && (
                      <div>
                        <span className="text-gray-400 text-xs">Mood</span>
                        <p className="text-gray-700 font-medium">
                          {c.mood_score}/10{c.mood_notes ? ` — ${c.mood_notes}` : ''}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
