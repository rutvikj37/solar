import React, { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import AiCallingAdminGate from "./components/ai-calling/AiCallingAdminGate";
import FullPageLoader from "./components/FullPageLoader";
import PageTransitionLoader from "./components/PageTransitionLoader";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const InteractiveMap = lazy(() => import("./pages/InteractiveMap"));
const PropertyAnalysis = lazy(() => import("./pages/PropertyAnalysis"));
const GeneratingLead = lazy(() => import("./pages/GeneratingLead"));
const LeadDetails = lazy(() => import("./pages/LeadDetails"));
const Billing = lazy(() => import("./pages/Billing"));
const Profile = lazy(() => import("./pages/Profile"));
const MyLeads = lazy(() => import("./pages/MyLeads"));
const Downloads = lazy(() => import("./pages/Downloads"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const CompleteProfilePage = lazy(() => import("./pages/CompleteProfilePage"));
const AutomationComingSoon = lazy(
  () => import("./components/AutomationComingSoon"),
);

const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Appointments = lazy(() => import("./pages/Appointments"));
const Support = lazy(() => import("./pages/Support"));
const SupportTicket = lazy(() => import("./pages/SupportTicket"));
const DripCampaigns = lazy(() => import("./pages/DripCampaigns"));

const AiCallingDashboard = lazy(
  () => import("./pages/ai-calling/AiCallingDashboard"),
);
const AiCallingCampaigns = lazy(
  () => import("./pages/ai-calling/AiCallingCampaigns"),
);
const AiCallingLiveMonitor = lazy(
  () => import("./pages/ai-calling/AiCallingLiveMonitor"),
);
const AiCallingKnowledgeBase = lazy(
  () => import("./pages/ai-calling/AiCallingKnowledgeBase"),
);
const AiCallingPrompts = lazy(
  () => import("./pages/ai-calling/AiCallingPrompts"),
);
const AiCallingAnalytics = lazy(
  () => import("./pages/ai-calling/AiCallingAnalytics"),
);
const AiCallingSettings = lazy(
  () => import("./pages/ai-calling/AiCallingSettings"),
);
const AiCallingCallDetail = lazy(
  () => import("./pages/ai-calling/AiCallingCallDetail"),
);

const PublicProposalView = lazy(() => import("./pages/PublicProposalView"));

function PackagesRedirect() {
  const { search } = useLocation();
  return (
    <Navigate
      to={search ? `/billing${search}#plans` : "/billing#plans"}
      replace
    />
  );
}

/** Persistent shell: auth once, AppLayout stays mounted across child routes. */
function AuthenticatedLayout() {
  return (
    <ProtectedRoute>
      <AppLayout />
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <PageTransitionLoader />
        <Suspense fallback={<FullPageLoader />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/complete-profile"
              element={
                <ProtectedRoute>
                  <CompleteProfilePage />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<LandingPage />} />
            <Route path="/proposal/:slug" element={<PublicProposalView />} />

            <Route element={<AuthenticatedLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/map" element={<InteractiveMap />} />
              <Route path="/analysis" element={<PropertyAnalysis />} />
              <Route path="/generate" element={<GeneratingLead />} />
              <Route path="/lead/:id" element={<LeadDetails />} />
              <Route path="/packages" element={<PackagesRedirect />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/my-leads" element={<MyLeads />} />
              <Route path="/downloads" element={<Downloads />} />
              <Route path="/bulk-scan" element={<AutomationComingSoon />} />
              <Route path="/appointments" element={<Appointments />} />
              <Route path="/drip" element={<DripCampaigns />} />
              <Route path="/support" element={<Support />} />
              <Route path="/support/:id" element={<SupportTicket />} />

              <Route element={<AiCallingAdminGate />}>
                <Route path="/ai-calling" element={<AiCallingDashboard />} />
                <Route
                  path="/ai-calling/campaigns"
                  element={<AiCallingCampaigns />}
                />
                <Route
                  path="/ai-calling/live"
                  element={<AiCallingLiveMonitor />}
                />
                <Route
                  path="/ai-calling/knowledge-base"
                  element={<AiCallingKnowledgeBase />}
                />
                <Route
                  path="/ai-calling/prompts"
                  element={<AiCallingPrompts />}
                />
                <Route
                  path="/ai-calling/analytics"
                  element={<AiCallingAnalytics />}
                />
                <Route
                  path="/ai-calling/settings"
                  element={<AiCallingSettings />}
                />
                <Route
                  path="/ai-calling/calls/:id"
                  element={<AiCallingCallDetail />}
                />
              </Route>

              <Route element={<ProtectedRoute requireAdmin />}>
                <Route path="/admin" element={<AdminDashboard />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
