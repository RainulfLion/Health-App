# Health Tracking App

A comprehensive health tracking application that integrates Garmin watch data with food logging and habit tracking to discover patterns that affect your sleep, energy, and overall health.

## Features

### Core Functionality

- **Garmin Integration**: Automatically sync health data from your Garmin watch including:
  - Sleep hours and quality
  - Steps and activity levels
  - Heart rate (average and resting)
  - Stress levels
  - Energy levels (Body Battery)

- **Food Logging**: Track your meals with:
  - Photo upload support
  - Calorie tracking
  - Meal timing
  - Notes and tags
  - Daily calorie summaries

- **Habit Tracking**: Log habits that might affect your health:
  - Coffee consumption
  - Alcohol intake
  - Medications
  - Exercise
  - Custom habits with intensity ratings

- **Pattern Detection**: Automatic correlation analysis to discover:
  - How late coffee affects sleep quality
  - Impact of meal timing on sleep and energy
  - Habit patterns that correlate with health outcomes
  - Statistical insights with sample sizes

### Example Use Cases

1. **Late Coffee Impact**: Log coffee consumption throughout the day. The app will analyze if coffee after 6 PM correlates with reduced sleep quality.

2. **Meal Timing**: Track dinner times. Discover if eating late (after 8 PM) affects your sleep quality.

3. **Habit Optimization**: See which habits improve or reduce your energy levels the next day.

## Tech Stack

### Backend
- Node.js + Express
- TypeScript
- SQLite database
- Garmin Health API integration
- Image upload with Multer

### Frontend
- React 18
- TypeScript
- Vite
- React Router
- Recharts for data visualization
- Lucide React for icons

## Installation

### Prerequisites
- Node.js 18+ and npm

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Health-App
   ```

2. **Install dependencies**
   ```bash
   npm run install-all
   ```

3. **Configure environment** (optional)
   Create a `.env` file in the backend directory:
   ```
   PORT=3001
   ```

4. **Start the development servers**

   Option 1 - Start both frontend and backend:
   ```bash
   npm run dev
   ```

   Option 2 - Start separately:
   ```bash
   # Terminal 1 - Backend
   npm run dev:backend

   # Terminal 2 - Frontend
   npm run dev:frontend
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

## Usage Guide

### Getting Started

1. **Set Up Garmin Sync** (Optional)
   - Navigate to "Garmin Sync" page
   - Follow instructions to get Garmin API access token
   - Or use manual entry to input health data from other sources

2. **Log Your First Meal**
   - Go to "Food Log" page
   - Click "Add Food"
   - Enter meal details, optionally upload a photo
   - Add calories if known

3. **Track Habits**
   - Navigate to "Habits" page
   - Click "Log Habit"
   - Select habit type (coffee, alcohol, etc.)
   - Enter time and optional intensity

4. **View Insights**
   - After logging data for a few days, visit "Insights" page
   - The app needs at least 3 data points to detect patterns
   - Review correlations between habits and health outcomes

### Understanding Insights

The app calculates correlations by comparing health metrics on days with and without specific habits:

- **Negative Impact (Red)**: Habit reduces sleep quality or energy
- **Positive Impact (Green)**: Habit improves health outcomes
- **Score**: Magnitude of impact (e.g., -15 means 15 points lower)
- **Sample Size**: Number of data points used in analysis

## API Endpoints

### Garmin Data
- `POST /api/garmin/token` - Set Garmin access token
- `POST /api/garmin/sync` - Sync single day
- `POST /api/garmin/sync-range` - Sync multiple days
- `POST /api/garmin/manual` - Manual data entry
- `GET /api/garmin/data` - Get health data by date range

### Food Logs
- `POST /api/food` - Create food log (multipart/form-data for images)
- `GET /api/food` - Get all food logs
- `GET /api/food/date/:date` - Get logs for specific date
- `PUT /api/food/:id` - Update food log
- `DELETE /api/food/:id` - Delete food log
- `GET /api/food/calories/daily` - Get daily calorie totals

### Habits
- `POST /api/habits` - Create habit entry
- `GET /api/habits` - Get all habits
- `GET /api/habits/date/:date` - Get habits for specific date
- `GET /api/habits/types` - Get unique habit types
- `PUT /api/habits/:id` - Update habit
- `DELETE /api/habits/:id` - Delete habit

### Analytics
- `GET /api/analytics/insights?days=30` - Get all insights
- `GET /api/analytics/habit/:habitType?days=30` - Analyze specific habit
- `GET /api/analytics/food-timing?days=30` - Analyze meal timing
- `GET /api/analytics/dashboard?days=7` - Get dashboard summary

## Project Structure

```
Health-App/
├── backend/
│   ├── src/
│   │   ├── database.ts           # Database setup and schema
│   │   ├── server.ts             # Express server
│   │   ├── services/
│   │   │   ├── garmin.ts         # Garmin API integration
│   │   │   └── analytics.ts      # Pattern detection engine
│   │   └── routes/
│   │       ├── garmin.ts         # Garmin endpoints
│   │       ├── food.ts           # Food logging endpoints
│   │       ├── habits.ts         # Habit tracking endpoints
│   │       └── analytics.ts      # Analytics endpoints
│   ├── data/                     # SQLite database
│   └── uploads/                  # Food images
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.tsx     # Main dashboard
│   │   │   ├── FoodLogger.tsx    # Food logging UI
│   │   │   ├── HabitTracker.tsx  # Habit tracking UI
│   │   │   ├── Insights.tsx      # Pattern insights
│   │   │   └── GarminSync.tsx    # Garmin sync UI
│   │   ├── services/
│   │   │   └── api.ts            # API client
│   │   ├── App.tsx               # Main app component
│   │   └── main.tsx              # Entry point
│   └── public/
└── package.json
```

## Database Schema

### garmin_data
Stores daily health metrics from Garmin watch or manual entry.

### food_logs
Tracks meals with photos, calories, and timing.

### habits
Records habit occurrences with type, time, and intensity.

### insights
Stores detected correlations and patterns.

### settings
Application configuration (e.g., Garmin access token).

## Development

### Building for Production

```bash
npm run build
```

This builds both the backend (to `backend/dist/`) and frontend (to `frontend/dist/`).

### Running Production Build

```bash
cd backend && npm start
```

Serve the frontend static files from `frontend/dist/` using a web server like nginx or serve.

## Garmin API Setup

1. Create a developer account at https://developer.garmin.com/
2. Register a new application
3. Request access to the Wellness API
4. Implement OAuth 1.0a flow to get access tokens
5. Use the `/api/garmin/token` endpoint to save your token

Note: The current implementation includes a placeholder for Garmin API calls. You'll need to implement the full OAuth flow and use the actual Garmin API endpoints.

## Future Enhancements

- AI-powered food recognition from photos
- Export data to CSV/PDF
- Weekly/monthly reports
- Goal setting and tracking
- Multi-user support with authentication
- Mobile app (React Native)
- Integration with other fitness platforms (Apple Health, Fitbit, etc.)
- Advanced data visualization with trends
- Push notifications for insights

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for your own health tracking needs.

## Privacy Note

All data is stored locally in your SQLite database. No data is sent to external servers except when syncing with Garmin's official API (if configured).
