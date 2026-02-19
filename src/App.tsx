import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import LandingPage from "./pages/Landing";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/auth/Login";
import RegisterPage from "./pages/auth/Register";
import ResetPage from "./pages/auth/Reset";
import DashboardPage from "./pages/Dashboard";
import JobDetailPage from "./pages/JobDetail";
import SettingsPage from "./pages/Settings";
import PrivacyPage from "./pages/Privacy";
import TermsPage from "./pages/Terms";
import DMCAPage from "./pages/DMCA";
import StatusPage from "./pages/Status";
import ExtensionPage from "./pages/Extension";

// Admin pages
import AdminOverview from "./pages/admin/Overview";
import AdminUsers from "./pages/admin/Users";
import AdminJobs from "./pages/admin/Jobs";
import AdminWorkers from "./pages/admin/Workers";
import AdminStorage from "./pages/admin/Storage";
import AdminSecurity from "./pages/admin/Security";
import AdminAudit from "./pages/admin/Audit";
import AdminSettingsPage from "./pages/admin/AdminSettings";
import AdminUserDetail from "./pages/admin/UserDetail";
import AdminLoginPage from "./pages/admin/AdminLogin";
import AdminInfrastructure from "./pages/admin/Infrastructure";
import AdminBlog from "./pages/admin/Blog";
import AdminBlogEditor from "./pages/admin/BlogEditor";
import AdminDLQ from "./pages/admin/DLQ";
import AdminGlobalSearch from "./pages/admin/GlobalSearch";
import AdminConfigHistory from "./pages/admin/ConfigHistory";
import AdminObservability from "./pages/admin/Observability";
import BlogPage from "./pages/Blog";
import BlogPostPage from "./pages/BlogPost";
import OrgSettingsPage from "./pages/OrgSettings";
import CreateOrgPage from "./pages/CreateOrg";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});


const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Root — landing page */}
          <Route path="/" element={<LandingPage />} />

          {/* Auth */}
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/register" element={<RegisterPage />} />
          <Route path="/auth/reset" element={<ResetPage />} />

          {/* Legal + Status — public pages */}
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/dmca" element={<DMCAPage />} />
          <Route path="/status" element={<StatusPage />} />
          <Route path="/extension" element={<ExtensionPage />} />

          {/* User app under /app/* */}
          <Route path="/app/dashboard" element={<DashboardPage />} />
          <Route path="/app/dashboard/:jobId" element={<JobDetailPage />} />
          <Route path="/app/settings" element={<SettingsPage />} />

          {/* Legacy /dashboard routes for backwards compat */}
          <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
          <Route path="/dashboard/:jobId" element={<Navigate to="/app/dashboard" replace />} />
          <Route path="/settings" element={<Navigate to="/app/settings" replace />} />

          {/* Admin auth */}
          <Route path="/admin/login" element={<AdminLoginPage />} />

          {/* Admin console under /admin/* — RBAC enforced server-side */}
          <Route path="/admin" element={<Navigate to="/admin/overview" replace />} />
          <Route path="/admin/overview" element={<AdminOverview />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/users/:id" element={<AdminUserDetail />} />
          <Route path="/admin/jobs" element={<AdminJobs />} />
          <Route path="/admin/workers" element={<AdminWorkers />} />
          <Route path="/admin/storage" element={<AdminStorage />} />
          <Route path="/admin/security" element={<AdminSecurity />} />
          <Route path="/admin/audit" element={<AdminAudit />} />
          <Route path="/admin/settings" element={<AdminSettingsPage />} />
          <Route path="/admin/infrastructure" element={<AdminInfrastructure />} />
          <Route path="/admin/blog" element={<AdminBlog />} />
          <Route path="/admin/blog/new" element={<AdminBlogEditor />} />
          <Route path="/admin/blog/:id/edit" element={<AdminBlogEditor />} />
          <Route path="/admin/dlq" element={<AdminDLQ />} />
          <Route path="/admin/search" element={<AdminGlobalSearch />} />
          <Route path="/admin/config-history" element={<AdminConfigHistory />} />
          <Route path="/admin/observability" element={<AdminObservability />} />

          {/* Org routes */}
          <Route path="/app/org/new" element={<CreateOrgPage />} />
          <Route path="/app/org/:slug/settings" element={<OrgSettingsPage />} />

          {/* Public Blog */}
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
