import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "./components/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NewShipment from "./pages/NewShipment";
import Queue from "./pages/Queue";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import { useAuth } from "./hooks/useAuth";

const queryClient = new QueryClient();

function RoleGuard({ children, allowed }: { children: React.ReactNode; allowed: boolean }) {
  if (!allowed) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { isProcessor, isAdmin } = useAuth();

  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/new" element={<NewShipment />} />
        <Route path="/queue" element={
          <RoleGuard allowed={isProcessor}><Queue /></RoleGuard>
        } />
        <Route path="/settings" element={
          <RoleGuard allowed={isAdmin}><Settings /></RoleGuard>
        } />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
