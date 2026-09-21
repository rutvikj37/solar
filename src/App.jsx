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
import CookieConsent from "./components/CookieConsent";

/** Lazy import that recovers from post-deploy 404s on hashed chunks. */
function lazyRoute(factory) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      const msg = String(err?.message || err || "");
      const isChunkMiss =
        msg.includes("Failed to fetch dynamically imported module") ||
        msg.includes("Importing a module script failed") ||
        err?.name === "ChunkLoadError";
      if (isChunkMiss) {
        try {
          const key = "str_chunk_reload";
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, "1");
            window.location.reload();
            return new Promise(() => {});
          }
          sessionStorage.removeItem(key);
        } catch {
          /* ignore */
        }
      }
      throw err;
    }
  });
}

const LandingPage = lazyRoute(() => import("./pages/homeowner/HomeownerLandingPage"));
const InstallerLandingPage = lazyRoute(() => import("./pages/marketing/InstallerLandingPage"));
const HomeownerAboutPage = lazyRoute(() => import("./pages/homeowner/HomeownerAboutPage"));
const HomeownerContactPage = lazyRoute(() => import("./pages/homeowner/HomeownerContactPage"));
const SolarReportPage = lazyRoute(() => import("./pages/homeowner/SolarReportPage"));
const Dashboard = lazyRoute(() => import("./pages/app/Dashboard"));
const InteractiveMap = lazyRoute(() => import("./pages/app/InteractiveMap"));
const PropertyAnalysis = lazyRoute(() => import("./pages/app/PropertyAnalysis"));
const GeneratingLead = lazyRoute(() => import("./pages/app/GeneratingLead"));
const LeadDetails = lazyRoute(() => import("./pages/app/LeadDetails"));
const Billing = lazyRoute(() => import("./pages/app/Billing"));
const Profile = lazyRoute(() => import("./pages/app/Profile"));
const IntegrationsPage = lazyRoute(() => import("./pages/app/IntegrationsPage"));
const MyLeads = lazyRoute(() => import("./pages/app/MyLeads"));
const Downloads = lazyRoute(() => import("./pages/app/Downloads"));
const LoginPage = lazyRoute(() => import("./pages/auth/LoginPage"));
const RegisterPage = lazyRoute(() => import("./pages/auth/RegisterPage"));
const VerifyEmailPage = lazyRoute(() => import("./pages/auth/VerifyEmailPage"));
const ForgotPasswordPage = lazyRoute(() => import("./pages/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazyRoute(() => import("./pages/auth/ResetPasswordPage"));
const FirebaseAuthActionPage = lazyRoute(() => import("./pages/auth/FirebaseAuthActionPage"));
const CompleteProfilePage = lazyRoute(() => import("./pages/auth/CompleteProfilePage"));
const BulkAreaScan = lazyRoute(() => import("./pages/app/BulkAreaScan"));

const AdminDashboard = lazyRoute(() => import("./pages/app/AdminDashboard"));
const Appointments = lazyRoute(() => import("./pages/app/Appointments"));
const Support = lazyRoute(() => import("./pages/app/Support"));
const SupportTicket = lazyRoute(() => import("./pages/app/SupportTicket"));
const DripCampaigns = lazyRoute(() => import("./pages/app/DripCampaigns"));

const AiCallingDashboard = lazyRoute(
  () => import("./pages/ai-calling/AiCallingDashboard"),
);
const AiCallingCampaigns = lazyRoute(
  () => import("./pages/ai-calling/AiCallingCampaigns"),
);
const AiCallingLiveMonitor = lazyRoute(
  () => import("./pages/ai-calling/AiCallingLiveMonitor"),
);
const AiCallingKnowledgeBase = lazyRoute(
  () => import("./pages/ai-calling/AiCallingKnowledgeBase"),
);
const AiCallingPrompts = lazyRoute(
  () => import("./pages/ai-calling/AiCallingPrompts"),
);
const AiCallingAnalytics = lazyRoute(
  () => import("./pages/ai-calling/AiCallingAnalytics"),
);
const AiCallingSettings = lazyRoute(
  () => import("./pages/ai-calling/AiCallingSettings"),
);
const AiCallingCallDetail = lazyRoute(
  () => import("./pages/ai-calling/AiCallingCallDetail"),
);

const PublicProposalView = lazyRoute(() => import("./pages/app/PublicProposalView"));
const GetSolarQuote = lazyRoute(() => import("./pages/app/GetSolarQuote"));
const Reports = lazyRoute(() => import("./pages/app/Reports"));
const MarketplaceDashboard = lazyRoute(
  () => import("./pages/marketplace/MarketplaceDashboard"),
);
const PrivacyPolicyPage = lazyRoute(() => import("./pages/legal/PrivacyPolicyPage"));
const TermsPage = lazyRoute(() => import("./pages/legal/TermsPage"));

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
          <CookieConsent />
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
