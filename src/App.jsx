import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AiCallingAdminGate from './components/ai-calling/AiCallingAdminGate';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const InteractiveMap = lazy(() => import('./pages/InteractiveMap'));
const PropertyAnalysis = lazy(() => import('./pages/PropertyAnalysis'));
const GeneratingLead = lazy(() => import('./pages/GeneratingLead'));
const LeadDetails = lazy(() => import('./pages/LeadDetails'));
// Packages page hidden from users — keep LeadPackages for possible re-enable:
// const LeadPackages = lazy(() => import('./pages/LeadPackages'));
const Billing = lazy(() => import('./pages/Billing'));
const Profile = lazy(() => import('./pages/Profile'));
const MyLeads = lazy(() => import('./pages/MyLeads'));
const Downloads = lazy(() => import('./pages/Downloads'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const AutomationComingSoon = lazy(() => import('./components/AutomationComingSoon'));
// BulkAreaScan kept for re-enable: lazy(() => import('./pages/BulkAreaScan'))

const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const Appointments = lazy(() => import('./pages/Appointments'));
const Support = lazy(() => import('./pages/Support'));
const SupportTicket = lazy(() => import('./pages/SupportTicket'));
const DripCampaigns = lazy(() => import('./pages/DripCampaigns'));

const AiCallingDashboard = lazy(() => import('./pages/ai-calling/AiCallingDashboard'));
const AiCallingCampaigns = lazy(() => import('./pages/ai-calling/AiCallingCampaigns'));
const AiCallingLiveMonitor = lazy(() => import('./pages/ai-calling/AiCallingLiveMonitor'));
const AiCallingKnowledgeBase = lazy(() => import('./pages/ai-calling/AiCallingKnowledgeBase'));
const AiCallingPrompts = lazy(() => import('./pages/ai-calling/AiCallingPrompts'));
const AiCallingAnalytics = lazy(() => import('./pages/ai-calling/AiCallingAnalytics'));
const AiCallingSettings = lazy(() => import('./pages/ai-calling/AiCallingSettings'));
const AiCallingCallDetail = lazy(() => import('./pages/ai-calling/AiCallingCallDetail'));

const PublicProposalView = lazy(() => import('./pages/PublicProposalView'));

function PageLoader() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#080B1A] text-white">
      <div className="flex flex-col items-center gap-3">
        <span className="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span>
        <p className="text-xs text-slate-400 font-semibold">Loading Page...</p>
      </div>
    </div>
  );
}

function withAuth(element, { requireAdmin = false } = {}) {
  return <ProtectedRoute requireAdmin={requireAdmin}>{element}</ProtectedRoute>;
}

function withAiCallingAuth(element) {
  return withAuth(<AiCallingAdminGate>{element}</AiCallingAdminGate>);
}

function PackagesRedirect() {
  const { search } = useLocation();
  return <Navigate to={search ? `/billing${search}#plans` : '/billing#plans'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/" element={<LandingPage />} />
            <Route path="/proposal/:slug" element={<PublicProposalView />} />

            <Route path="/dashboard" element={withAuth(<Dashboard />)} />
            <Route path="/map" element={withAuth(<InteractiveMap />)} />
            <Route path="/analysis" element={withAuth(<PropertyAnalysis />)} />
            <Route path="/generate" element={withAuth(<GeneratingLead />)} />
            <Route path="/lead/:id" element={withAuth(<LeadDetails />)} />
            <Route path="/packages" element={withAuth(<PackagesRedirect />)} />
            <Route path="/billing" element={withAuth(<Billing />)} />
            <Route path="/profile" element={withAuth(<Profile />)} />
            <Route path="/my-leads" element={withAuth(<MyLeads />)} />
            <Route path="/downloads" element={withAuth(<Downloads />)} />
            <Route path="/bulk-scan" element={withAuth(<AutomationComingSoon />)} />
            <Route path="/appointments" element={withAuth(<Appointments />)} />
            <Route path="/drip" element={withAuth(<DripCampaigns />)} />
            <Route path="/support" element={withAuth(<Support />)} />

            {/* AI Voice Calling Automation — admin only for now */}
            <Route path="/ai-calling" element={withAiCallingAuth(<AiCallingDashboard />)} />
            <Route path="/ai-calling/campaigns" element={withAiCallingAuth(<AiCallingCampaigns />)} />
            <Route path="/ai-calling/live" element={withAiCallingAuth(<AiCallingLiveMonitor />)} />
            <Route path="/ai-calling/knowledge-base" element={withAiCallingAuth(<AiCallingKnowledgeBase />)} />
            <Route path="/ai-calling/prompts" element={withAiCallingAuth(<AiCallingPrompts />)} />
            <Route path="/ai-calling/analytics" element={withAiCallingAuth(<AiCallingAnalytics />)} />
            <Route path="/ai-calling/settings" element={withAiCallingAuth(<AiCallingSettings />)} />
            <Route path="/ai-calling/calls/:id" element={withAiCallingAuth(<AiCallingCallDetail />)} />
            <Route path="/support/:id" element={withAuth(<SupportTicket />)} />
            <Route path="/admin" element={withAuth(<AdminDashboard />, { requireAdmin: true })} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
