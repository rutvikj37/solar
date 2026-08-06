import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import InteractiveMap from './pages/InteractiveMap';
import PropertyAnalysis from './pages/PropertyAnalysis';
import GeneratingLead from './pages/GeneratingLead';
import LeadDetails from './pages/LeadDetails';
import LeadPackages from './pages/LeadPackages';
import Billing from './pages/Billing';
import Profile from './pages/Profile';
import MyLeads from './pages/MyLeads';
import Downloads from './pages/Downloads';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import BulkAreaScan from './pages/BulkAreaScan';
import AdminDashboard from './pages/AdminDashboard';
import Appointments from './pages/Appointments';
import CallCenter from './pages/CallCenter';
import ScheduledCalls from './pages/ScheduledCalls';
import BulkCalls from './pages/BulkCalls';
import Support from './pages/Support';
import SupportTicket from './pages/SupportTicket';
import ProtectedRoute from './components/ProtectedRoute';

function withAuth(element) {
  return <ProtectedRoute>{element}</ProtectedRoute>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<LandingPage />} />

        <Route path="/dashboard" element={withAuth(<Dashboard />)} />
        <Route path="/map" element={withAuth(<InteractiveMap />)} />
        <Route path="/analysis" element={withAuth(<PropertyAnalysis />)} />
        <Route path="/generate" element={withAuth(<GeneratingLead />)} />
        <Route path="/lead/:id" element={withAuth(<LeadDetails />)} />
        <Route path="/packages" element={withAuth(<LeadPackages />)} />
        <Route path="/billing" element={withAuth(<Billing />)} />
        <Route path="/profile" element={withAuth(<Profile />)} />
        <Route path="/my-leads" element={withAuth(<MyLeads />)} />
        <Route path="/downloads" element={withAuth(<Downloads />)} />
        <Route path="/bulk-scan" element={withAuth(<BulkAreaScan />)} />
        <Route path="/appointments" element={withAuth(<Appointments />)} />
        <Route path="/call-center" element={withAuth(<CallCenter />)} />
        <Route path="/scheduled-calls" element={withAuth(<ScheduledCalls />)} />
        <Route path="/bulk-calls" element={withAuth(<BulkCalls />)} />
        <Route path="/support" element={withAuth(<Support />)} />
        <Route path="/support/:id" element={withAuth(<SupportTicket />)} />
        <Route path="/admin" element={withAuth(<AdminDashboard />)} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
