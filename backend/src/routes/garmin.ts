import express from 'express';
import garminService from '../services/garmin';
import { format, subDays } from 'date-fns';

const router = express.Router();

// Login to Garmin Connect
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    await garminService.login(username, password);
    res.json({ message: 'Successfully logged in to Garmin Connect' });
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

// Logout from Garmin Connect
router.post('/logout', (req, res) => {
  garminService.logout();
  res.json({ message: 'Logged out successfully' });
});

// Check login status
router.get('/status', (req, res) => {
  res.json({ isLoggedIn: garminService.isLoggedIn() });
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
    const endDate = format(new Date(), 'yyyy-MM-dd');
    const startDate = format(subDays(new Date(), days - 1), 'yyyy-MM-dd');

    const syncedDays = await garminService.syncDateRange(startDate, endDate);
    res.json({ message: `Synced ${syncedDays} out of ${days} days successfully`, syncedDays });
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
