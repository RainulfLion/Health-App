import { useState, useEffect } from 'react';
import { habitsAPI, Habit } from '../services/api';
import { format } from 'date-fns';
import { Plus, Trash2, Coffee, Wine, Cigarette, Pill } from 'lucide-react';

const COMMON_HABITS = [
  { value: 'coffee', label: 'Coffee', icon: Coffee },
  { value: 'alcohol', label: 'Alcohol', icon: Wine },
  { value: 'smoking', label: 'Smoking', icon: Cigarette },
  { value: 'medication', label: 'Medication', icon: Pill }
];

function HabitTracker() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(), 'HH:mm'),
    habitType: '',
    description: '',
    intensity: ''
  });

  useEffect(() => {
    loadHabits();
  }, []);

  const loadHabits = async () => {
    try {
      setLoading(true);
      const response = await habitsAPI.getAll();
      setHabits(response.data);
    } catch (error) {
      console.error('Error loading habits:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data: Habit = {
      date: formData.date,
      time: formData.time,
      habit_type: formData.habitType,
      description: formData.description || undefined,
      intensity: formData.intensity ? parseInt(formData.intensity) : undefined
    };

    try {
      await habitsAPI.create(data);
      setMessage({ type: 'success', text: 'Habit logged successfully!' });
      setShowForm(false);
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        time: format(new Date(), 'HH:mm'),
        habitType: '',
        description: '',
        intensity: ''
      });
      loadHabits();

      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to log habit' });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this habit entry?')) {
      try {
        await habitsAPI.delete(id);
        setMessage({ type: 'success', text: 'Habit entry deleted' });
        loadHabits();
        setTimeout(() => setMessage(null), 3000);
      } catch (error) {
        setMessage({ type: 'error', text: 'Failed to delete habit entry' });
      }
    }
  };

  const getHabitIcon = (habitType: string) => {
    const habit = COMMON_HABITS.find(h => h.value === habitType.toLowerCase());
    return habit?.icon || null;
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Habit Tracker</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={20} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
          {showForm ? 'Cancel' : 'Log Habit'}
        </button>
      </div>

      {message && (
        <div className={message.type}>{message.text}</div>
      )}

      {showForm && (
        <div className="card">
          <h2>Log Habit</h2>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
            Track habits that might affect your sleep, energy, and health. Examples: coffee, alcohol, exercise, medication.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-2">
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Time</label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Habit Type</label>
              <select
                value={formData.habitType}
                onChange={(e) => setFormData({ ...formData, habitType: e.target.value })}
                required
              >
                <option value="">Select a habit...</option>
                {COMMON_HABITS.map(habit => (
                  <option key={habit.value} value={habit.value}>
                    {habit.label}
                  </option>
                ))}
                <option value="custom">Custom...</option>
              </select>
            </div>

            {formData.habitType === 'custom' && (
              <div className="form-group">
                <label>Custom Habit Name</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, habitType: e.target.value })}
                  placeholder="e.g., Late night snack"
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label>Description (optional)</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., Double espresso"
              />
            </div>

            <div className="form-group">
              <label>Intensity (optional, 1-10)</label>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.intensity}
                onChange={(e) => setFormData({ ...formData, intensity: e.target.value })}
                placeholder="1-10"
              />
            </div>

            <button type="submit" className="btn btn-primary">Log Habit</button>
          </form>
        </div>
      )}

      <div className="card">
        <h2>Recent Habits</h2>
        {loading ? (
          <div className="loading">Loading...</div>
        ) : habits.length === 0 ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
            No habits logged yet. Start tracking to discover patterns!
          </p>
        ) : (
          <div>
            {habits.map((habit) => {
              const Icon = getHabitIcon(habit.habit_type);
              return (
                <div key={habit.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem',
                  borderBottom: '1px solid #e5e7eb'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                    {Icon && <Icon size={24} style={{ color: '#3b82f6' }} />}
                    <div>
                      <div style={{ fontWeight: '600', textTransform: 'capitalize' }}>
                        {habit.habit_type}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        {habit.date} at {habit.time}
                      </div>
                      {habit.description && (
                        <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                          {habit.description}
                        </div>
                      )}
                    </div>
                  </div>
                  {habit.intensity && (
                    <div style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#e5e7eb',
                      borderRadius: '6px',
                      fontWeight: '600'
                    }}>
                      {habit.intensity}/10
                    </div>
                  )}
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDelete(habit.id!)}
                    style={{ marginLeft: '1rem' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default HabitTracker;
