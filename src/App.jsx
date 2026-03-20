import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Reservation from './components/Reservation';
import Billing from './components/Billing';
import WalkIn from './components/WalkIn';
import GuestRecords from './components/GuestRecords';
import Reports from './components/Reports';
import Sidebar from './components/Layout/Sidebar';
import { isAuthenticated, hasRole } from './utils/appData';

// Protected Route wrapper component
const ProtectedRoute = ({ children, roles = [] }) => {
    if (!isAuthenticated()) {
        return <Navigate to="/login" replace />;
    }

    if (!hasRole(roles)) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
};

function App() {
    return (
        <Router>
            <Routes>
                {/* Public login route */}
                <Route path="/login" element={<Login />} />
                
                {/* Protected routes - Sidebar is now INSIDE each component */}
                <Route path="/" element={
                    <ProtectedRoute>
                        <Dashboard />
                    </ProtectedRoute>
                } />
                
                <Route path="/dashboard" element={
                    <ProtectedRoute>
                        <Dashboard />
                    </ProtectedRoute>
                } />
                
                <Route path="/reservation" element={
                    <ProtectedRoute>
                        <Reservation />
                    </ProtectedRoute>
                } />
                
                <Route path="/billing" element={
                    <ProtectedRoute>
                        <Billing />
                    </ProtectedRoute>
                } />
                
                <Route path="/walkin" element={
                    <ProtectedRoute>
                        <WalkIn />
                    </ProtectedRoute>
                } />
                
                <Route path="/records" element={
                    <ProtectedRoute>
                        <GuestRecords />
                    </ProtectedRoute>
                } />
                
                <Route path="/reports" element={
                    <ProtectedRoute>
                        <Reports />
                    </ProtectedRoute>
                } />

                {/* Admin and Owner routes */}
                <Route path="/owner" element={
                    <ProtectedRoute roles={['owner']}>
                        <div className="flex h-screen">
                            <Sidebar>
                                <div className="p-8 bg-gray-50 min-h-screen w-full">
                                    <div className="bg-white rounded-2xl p-8 shadow-sm">
                                        <h1 className="text-2xl font-bold text-[#1e3a8a]">Owner Interface</h1>
                                        <p className="text-gray-600 mt-2">This area is for owner-level reports and analytics.</p>
                                    </div>
                                </div>
                            </Sidebar>
                        </div>
                    </ProtectedRoute>
                } />

                <Route path="/admin" element={
                    <ProtectedRoute roles={['admin', 'owner']}>
                        <div className="flex h-screen">
                            <Sidebar>
                                <div className="p-8 bg-gray-50 min-h-screen w-full">
                                    <div className="bg-white rounded-2xl p-8 shadow-sm">
                                        <h1 className="text-2xl font-bold text-[#1e3a8a]">Admin Interface</h1>
                                        <p className="text-gray-600 mt-2">This area is for administrative tasks.</p>
                                    </div>
                                </div>
                            </Sidebar>
                        </div>
                    </ProtectedRoute>
                } />

                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </Router>
    );
}

export default App;