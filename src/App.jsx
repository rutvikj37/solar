import React, { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";
import FullPageLoader from "./components/layout/FullPageLoader";
import PageTransitionLoader from "./components/layout/PageTransitionLoader";
/** Eager: homepage is the LCP path — avoid Suspense satellite loader + extra chunk round-trip. */
import LandingPage from "./pages/homeowner/HomeownerLandingPage";

const InstallerLandingPage = lazy(() => import("./pages/marketing/InstallerLandingPage"));
const HomeownerAboutPage = lazy(() => import("./pages/homeowner/HomeownerAboutPage"));
const HomeownerContactPage = lazy(() => import("./pages/homeowner/HomeownerContactPage"));
const SolarReportPage = lazy(() => import("./pages/homeowner/SolarReportPage"));
const Dashboard = lazy(() => import("./pages/app/Dashboard"));
const InteractiveMap = lazy(() => import("./pages/app/InteractiveMap"));
const PropertyAnalysis = lazy(() => import("./pages/app/PropertyAnalysis"));
const GeneratingLead = lazy(() => import("./pages/app/GeneratingLead"));
const LeadDetails = lazy(() => import("./pages/app/LeadDetails"));
const Billing = lazy(() => import("./pages/app/Billing"));
const Profile = lazy(() => import("./pages/app/Profile"));
const IntegrationsPage = lazy(() => import("./pages/app/IntegrationsPage"));
const MyLeads = lazy(() => import("./pages/app/MyLeads"));
const Downloads = lazy(() => import("./pages/app/Downloads"));
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("./pages/auth/RegisterPage"));
const VerifyEmailPage = lazy(() => import("./pages/auth/VerifyEmailPage"));
const ForgotPasswordPage = lazy(() => import("./pages/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/auth/ResetPasswordPage"));
const FirebaseAuthActionPage = lazy(() => import("./pages/auth/FirebaseAuthActionPage"));
const CompleteProfilePage = lazy(() => import("./pages/auth/CompleteProfilePage"));
const BulkAreaScan = lazy(() => import("./pages/app/BulkAreaScan"));

const AdminDashboard = lazy(() => import("./pages/app/AdminDashboard"));
const Appointments = lazy(() => import("./pages/app/Appointments"));
const Support = lazy(() => import("./pages/app/Support"));
const SupportTicket = lazy(() => import("./pages/app/SupportTicket"));
const DripCampaigns = lazy(() => import("./pages/app/DripCampaigns"));

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

const PublicProposalView = lazy(() => import("./pages/app/PublicProposalView"));
const GetSolarQuote = lazy(() => import("./pages/app/GetSolarQuote"));
const Reports = lazy(() => import("./pages/app/Reports"));
const MarketplaceDashboard = lazy(
  () => import("./pages/marketplace/MarketplaceDashboard"),
);
const PrivacyPolicyPage = lazy(() => import("./pages/legal/PrivacyPolicyPage"));
const TermsPage = lazy(() => import("./pages/legal/TermsPage"));

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
    <ThemeProvider>
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
              <Route path="/auth/action" element={<FirebaseAuthActionPage />} />
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
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsPage />} />
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
    </ThemeProvider>
  );
}
