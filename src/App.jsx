import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Reservation from './components/Reservation';
import Billing from './components/Billing';
import WalkIn from './components/WalkIn';
import GuestRecords from './components/GuestRecords';
import Reports from './components/Reports';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/reservation" element={<Reservation />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/walkin" element={<WalkIn />} />
        <Route path="/records" element={<GuestRecords />} />
        <Route path="/reports" element={<Reports />} />
      </Routes>
    </Router>
  );
}

export default App;