import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Financials from './pages/Financials';
import Transactions from './pages/Transactions';
import './assets/css/custom.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/financials" element={<Financials />} />
        <Route path="/transactions" element={<Transactions />} />
      </Routes>
    </Router>
  );
}

export default App;
