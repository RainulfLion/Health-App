import { useState, useEffect } from 'react';
import { analyticsAPI, Insight } from '../services/api';
import { TrendingDown, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';

function Insights() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(30);

  useEffect(() => {
    loadInsights();
  }, [days]);

  const loadInsights = async () => {
    try {
      setLoading(true);
      const response = await analyticsAPI.getInsights(days);
      setInsights(response.data);
    } catch (error) {
      console.error('Error loading insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInsightColor = (score: number) => {
    if (score < -10) return '#ef4444'; // Strong negative (red)
    if (score < 0) return '#f59e0b';   // Mild negative (orange)
    if (score > 10) return '#10b981';  // Strong positive (green)
    if (score > 0) return '#3b82f6';   // Mild positive (blue)
    return '#6b7280';                   // Neutral (gray)
  };

  const getInsightIcon = (score: number) => {
    if (score < 0) return TrendingDown;
    if (score > 0) return TrendingUp;
    return AlertCircle;
  };

  const formatEffect = (effect: string) => {
    return effect.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1>Health Insights</h1>
          <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>
            Discover patterns between your habits and health outcomes
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #e5e7eb' }}
          >
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button className="btn btn-primary" onClick={loadInsights} disabled={loading}>
            <RefreshCw size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Analyzing patterns...</div>
      ) : insights.length === 0 ? (
        <div className="card">
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <AlertCircle size={48} style={{ color: '#6b7280', marginBottom: '1rem' }} />
            <h3>Not Enough Data</h3>
            <p style={{ color: '#6b7280', marginTop: '1rem' }}>
              Keep logging your food, habits, and Garmin data to discover insights.
              We need at least 3 data points to identify patterns.
            </p>
          </div>
        </div>
      ) : (
        <div>
          <div className="card" style={{ marginBottom: '2rem' }}>
            <h2>How to Read Insights</h2>
            <div className="grid grid-2" style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <TrendingDown size={24} style={{ color: '#ef4444' }} />
                <div>
                  <div style={{ fontWeight: '600' }}>Negative Impact</div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    Red/Orange indicators show habits that may reduce sleep quality or energy
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <TrendingUp size={24} style={{ color: '#10b981' }} />
                <div>
                  <div style={{ fontWeight: '600' }}>Positive Impact</div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    Green/Blue indicators show habits that may improve outcomes
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-2">
            {insights.map((insight, index) => {
              const Icon = getInsightIcon(insight.score);
              const color = getInsightColor(insight.score);
              const impactPercent = Math.abs(insight.score).toFixed(1);

              return (
                <div
                  key={index}
                  className="card"
                  style={{ borderTop: `4px solid ${color}` }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '1rem'
                      }}>
                        <Icon size={24} style={{ color }} />
                        <h3 style={{ margin: 0 }}>{insight.trigger}</h3>
                      </div>

                      <div style={{
                        fontSize: '0.875rem',
                        color: '#6b7280',
                        marginBottom: '1rem'
                      }}>
                        Effect on: <strong>{formatEffect(insight.effect)}</strong>
                      </div>

                      <p style={{ fontSize: '0.875rem', lineHeight: '1.5', marginBottom: '1rem' }}>
                        {insight.description}
                      </p>

                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: '1rem',
                        borderTop: '1px solid #e5e7eb'
                      }}>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                          Based on {insight.sampleSize} samples
                        </div>
                        <div style={{
                          fontSize: '1.5rem',
                          fontWeight: '700',
                          color
                        }}>
                          {insight.score > 0 ? '+' : ''}{impactPercent}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card" style={{ marginTop: '2rem' }}>
            <h3>Example Use Case: Late Coffee</h3>
            <p style={{ color: '#6b7280', lineHeight: '1.6' }}>
              If you log coffee habits (especially in the evening) and sync your Garmin sleep data,
              the app will automatically detect if late coffee correlates with poor sleep quality.
              For example, you might discover: "Coffee after 6 PM reduces sleep quality by 15 points.
              Average with: 68, without: 83."
            </p>
            <p style={{ color: '#6b7280', lineHeight: '1.6', marginTop: '1rem' }}>
              This helps you make informed decisions about your habits based on actual data from your body.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Insights;
