import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/auth/Login";
import RegisterPage from "./pages/auth/Register";
import DashboardPage from "./pages/Dashboard";
import JobDetailPage from "./pages/JobDetail";
import SettingsPage from "./pages/Settings";

// Admin pages
import AdminOverview from "./pages/admin/Overview";
import AdminUsers from "./pages/admin/Users";
import AdminJobs from "./pages/admin/Jobs";
import AdminWorkers from "./pages/admin/Workers";
import AdminStorage from "./pages/admin/Storage";
import AdminSecurity from "./pages/admin/Security";
import AdminAudit from "./pages/admin/Audit";
import AdminSettingsPage from "./pages/admin/AdminSettings";

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
          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/app/dashboard" replace />} />

          {/* Auth */}
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/register" element={<RegisterPage />} />

          {/* User app under /app/* */}
          <Route path="/app/dashboard" element={<DashboardPage />} />
          <Route path="/app/dashboard/:jobId" element={<JobDetailPage />} />
          <Route path="/app/settings" element={<SettingsPage />} />

          {/* Legacy /dashboard routes for backwards compat */}
          <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
          <Route path="/dashboard/:jobId" element={<Navigate to="/app/dashboard" replace />} />
          <Route path="/settings" element={<Navigate to="/app/settings" replace />} />

          {/* Admin console under /admin/* — RBAC enforced server-side */}
          <Route path="/admin" element={<Navigate to="/admin/overview" replace />} />
          <Route path="/admin/overview" element={<AdminOverview />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/jobs" element={<AdminJobs />} />
          <Route path="/admin/workers" element={<AdminWorkers />} />
          <Route path="/admin/storage" element={<AdminStorage />} />
          <Route path="/admin/security" element={<AdminSecurity />} />
          <Route path="/admin/audit" element={<AdminAudit />} />
          <Route path="/admin/settings" element={<AdminSettingsPage />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
