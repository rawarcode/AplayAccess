import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Reservation from './components/Reservation';
import Billing from './components/Billing';
import WalkIn from './components/WalkIn';
import GuestRecords from './components/GuestRecords';
import Reports from './components/Reports';
import Sidebar from './components/Layout/Sidebar';
import { isAuthenticated, hasRole } from './utils/appData';

const ProtectedRoute = ({ children, roles = [] }) => {
    if (!isAuthenticated()) {
        return <Navigate to="/staff/login" replace />;
    }
    if (!hasRole(roles)) {
        return <Navigate to="/staff/dashboard" replace />;
    }
    return children;
};

export default function StaffApp() {
    return (
        <Routes>
            <Route path="login" element={<Login />} />

            <Route path="dashboard" element={
                <ProtectedRoute>
                    <Dashboard />
                </ProtectedRoute>
            } />

            <Route path="reservation" element={
                <ProtectedRoute>
                    <Reservation />
                </ProtectedRoute>
            } />

            <Route path="billing" element={
                <ProtectedRoute>
                    <Billing />
                </ProtectedRoute>
            } />

            <Route path="walkin" element={
                <ProtectedRoute>
                    <WalkIn />
                </ProtectedRoute>
            } />

            <Route path="records" element={
                <ProtectedRoute>
                    <GuestRecords />
                </ProtectedRoute>
            } />

            <Route path="reports" element={
                <ProtectedRoute>
                    <Reports />
                </ProtectedRoute>
            } />

            <Route path="owner" element={
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

            <Route path="admin" element={
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

            {/* Default: redirect to staff dashboard */}
            <Route path="*" element={<Navigate to="/staff/dashboard" replace />} />
        </Routes>
    );
}
