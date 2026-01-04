import { useState, useEffect } from 'react';
import { foodAPI, FoodLog } from '../services/api';
import { format } from 'date-fns';
import { Camera, Trash2, Plus } from 'lucide-react';

function FoodLogger() {
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(), 'HH:mm'),
    foodName: '',
    calories: '',
    notes: '',
    tags: ''
  });

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const response = await foodAPI.getAll();
      setLogs(response.data);
    } catch (error) {
      console.error('Error loading food logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = new FormData();
    data.append('date', formData.date);
    data.append('time', formData.time);
    data.append('foodName', formData.foodName);
    if (formData.calories) data.append('calories', formData.calories);
    if (formData.notes) data.append('notes', formData.notes);
    if (formData.tags) data.append('tags', formData.tags);
    if (selectedImage) data.append('image', selectedImage);

    try {
      await foodAPI.create(data);
      setMessage({ type: 'success', text: 'Food logged successfully!' });
      setShowForm(false);
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        time: format(new Date(), 'HH:mm'),
        foodName: '',
        calories: '',
        notes: '',
        tags: ''
      });
      setSelectedImage(null);
      setImagePreview(null);
      loadLogs();

      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to log food' });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this food log?')) {
      try {
        await foodAPI.delete(id);
        setMessage({ type: 'success', text: 'Food log deleted' });
        loadLogs();
        setTimeout(() => setMessage(null), 3000);
      } catch (error) {
        setMessage({ type: 'error', text: 'Failed to delete food log' });
      }
    }
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Food Log</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={20} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
          {showForm ? 'Cancel' : 'Add Food'}
        </button>
      </div>

      {message && (
        <div className={message.type}>{message.text}</div>
      )}

      {showForm && (
        <div className="card">
          <h2>Log Food</h2>
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
              <label>Food Name</label>
              <input
                type="text"
                value={formData.foodName}
                onChange={(e) => setFormData({ ...formData, foodName: e.target.value })}
                placeholder="e.g., Grilled chicken salad"
                required
              />
            </div>

            <div className="form-group">
              <label>Calories (optional)</label>
              <input
                type="number"
                value={formData.calories}
                onChange={(e) => setFormData({ ...formData, calories: e.target.value })}
                placeholder="e.g., 350"
              />
            </div>

            <div className="form-group">
              <label>
                <Camera size={18} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                Photo (optional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
              />
              {imagePreview && (
                <img src={imagePreview} alt="Preview" className="image-preview" />
              )}
            </div>

            <div className="form-group">
              <label>Notes (optional)</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any notes about this meal..."
                rows={3}
              />
            </div>

            <div className="form-group">
              <label>Tags (optional)</label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="e.g., breakfast, healthy, restaurant"
              />
            </div>

            <button type="submit" className="btn btn-primary">Log Food</button>
          </form>
        </div>
      )}

      <div className="card">
        <h2>Recent Meals</h2>
        {loading ? (
          <div className="loading">Loading...</div>
        ) : logs.length === 0 ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
            No food logs yet. Start by adding your first meal!
          </p>
        ) : (
          <div>
            {logs.map((log) => (
              <div key={log.id} className="food-log-item">
                {log.image_path && (
                  <img src={log.image_path} alt={log.food_name} />
                )}
                <div className="food-log-details">
                  <div className="name">{log.food_name}</div>
                  <div className="time">
                    {log.date} at {log.time}
                  </div>
                  {log.calories && (
                    <div className="calories">{log.calories} cal</div>
                  )}
                  {log.notes && (
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
                      {log.notes}
                    </div>
                  )}
                  {log.tags && (
                    <div style={{ marginTop: '0.5rem' }}>
                      {log.tags.split(',').map((tag, i) => (
                        <span
                          key={i}
                          style={{
                            display: 'inline-block',
                            backgroundColor: '#e5e7eb',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            marginRight: '0.5rem'
                          }}
                        >
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  className="btn btn-danger"
                  onClick={() => handleDelete(log.id!)}
                  style={{ alignSelf: 'flex-start' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default FoodLogger;
