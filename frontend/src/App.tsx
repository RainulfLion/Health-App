import { BrowserRouter as Router, Routes, Route, Link, NavLink } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import FoodLogger from './components/FoodLogger';
import HabitTracker from './components/HabitTracker';
import Insights from './components/Insights';
import GarminSync from './components/GarminSync';
import TelegramSetup from './components/TelegramSetup';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <nav className="navbar">
          <h1>Health Tracker</h1>
          <ul className="nav-links">
            <li><NavLink to="/">Dashboard</NavLink></li>
            <li><NavLink to="/food">Food Log</NavLink></li>
            <li><NavLink to="/habits">Habits</NavLink></li>
            <li><NavLink to="/insights">Insights</NavLink></li>
            <li><NavLink to="/garmin">Garmin Sync</NavLink></li>
            <li><NavLink to="/telegram">Telegram Bot</NavLink></li>
          </ul>
        </nav>

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/food" element={<FoodLogger />} />
          <Route path="/habits" element={<HabitTracker />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/garmin" element={<GarminSync />} />
          <Route path="/telegram" element={<TelegramSetup />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
