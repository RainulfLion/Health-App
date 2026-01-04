import express from 'express';
import garminService from '../services/garmin';
import { format, subDays } from 'date-fns';

const router = express.Router();

// Set Garmin access token
router.post('/token', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Access token is required' });
  }

  garminService.setAccessToken(token);
  res.json({ message: 'Token saved successfully' });
});

// Sync data from Garmin API
router.post('/sync', async (req, res) => {
  const { date } = req.body;
  const syncDate = date || format(new Date(), 'yyyy-MM-dd');

  try {
    await garminService.syncData(syncDate);
    res.json({ message: 'Data synced successfully', date: syncDate });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Sync last N days
router.post('/sync-range', async (req, res) => {
  const { days = 7 } = req.body;

  try {
    const promises = [];
    for (let i = 0; i < days; i++) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
      promises.push(garminService.syncData(date));
    }
    await Promise.all(promises);
    res.json({ message: `Synced ${days} days successfully` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Manual data entry
router.post('/manual', (req, res) => {
  try {
    garminService.manualEntry(req.body);
    res.json({ message: 'Data saved successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get data by date range
router.get('/data', (req, res) => {
  const endDate = req.query.endDate as string || format(new Date(), 'yyyy-MM-dd');
  const startDate = req.query.startDate as string || format(subDays(new Date(), 30), 'yyyy-MM-dd');

  const data = garminService.getDataByDateRange(startDate, endDate);
  res.json(data);
});

export default router;
