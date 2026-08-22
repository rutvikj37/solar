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
import FullPageLoader from "./components/FullPageLoader";
import PageTransitionLoader from "./components/PageTransitionLoader";

const LandingPage = lazy(() => import("./pages/homeowner/HomeownerLandingPage"));
const InstallerLandingPage = lazy(() => import("./pages/InstallerLandingPage"));
const HomeownerAboutPage = lazy(() => import("./pages/homeowner/HomeownerAboutPage"));
const HomeownerContactPage = lazy(() => import("./pages/homeowner/HomeownerContactPage"));
const SolarReportPage = lazy(() => import("./pages/homeowner/SolarReportPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const InteractiveMap = lazy(() => import("./pages/InteractiveMap"));
const PropertyAnalysis = lazy(() => import("./pages/PropertyAnalysis"));
const GeneratingLead = lazy(() => import("./pages/GeneratingLead"));
const LeadDetails = lazy(() => import("./pages/LeadDetails"));
const Billing = lazy(() => import("./pages/Billing"));
const Profile = lazy(() => import("./pages/Profile"));
const IntegrationsPage = lazy(() => import("./pages/IntegrationsPage"));
const MyLeads = lazy(() => import("./pages/MyLeads"));
const Downloads = lazy(() => import("./pages/Downloads"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const CompleteProfilePage = lazy(() => import("./pages/CompleteProfilePage"));
const BulkAreaScan = lazy(() => import("./pages/BulkAreaScan"));

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
const GetSolarQuote = lazy(() => import("./pages/GetSolarQuote"));
const Reports = lazy(() => import("./pages/Reports"));
const MarketplaceDashboard = lazy(
  () => import("./pages/marketplace/MarketplaceDashboard"),
);

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
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route
              path="/complete-profile"
              element={
                <ProtectedRoute>
                  <CompleteProfilePage />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<LandingPage />} />
            <Route path="/about" element={<HomeownerAboutPage />} />
            <Route path="/contact" element={<HomeownerContactPage />} />
            <Route path="/solar-report" element={<SolarReportPage />} />
            <Route path="/for-installers" element={<InstallerLandingPage />} />
            <Route path="/get-solar-quote" element={<GetSolarQuote />} />
            <Route path="/proposal/:slug" element={<PublicProposalView />} />

            <Route element={<AuthenticatedLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/marketplace" element={<MarketplaceDashboard />} />
              <Route path="/map" element={<InteractiveMap />} />
              <Route path="/analysis" element={<PropertyAnalysis />} />
              <Route path="/generate" element={<GeneratingLead />} />
              <Route path="/lead/:id" element={<LeadDetails />} />
              <Route path="/packages" element={<PackagesRedirect />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/my-leads" element={<MyLeads />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/downloads" element={<Downloads />} />
              <Route path="/bulk-scan" element={<BulkAreaScan />} />
              <Route path="/appointments" element={<Appointments />} />
              <Route path="/drip" element={<DripCampaigns />} />
              <Route path="/support" element={<Support />} />
              <Route path="/support/:id" element={<SupportTicket />} />

              <Route element={<ProtectedRoute requireAdmin />}>
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
