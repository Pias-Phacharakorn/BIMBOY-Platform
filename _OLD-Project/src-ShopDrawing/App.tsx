import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthPage from "./components/AuthPage";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Projects from "./pages/Projects";
import QRScanner from "./pages/QRScanner";
import Activity from "./pages/Activity";
import PdfTools from "./pages/PdfTools";
import CadViewer from "./pages/CadViewer";
import Workforce from "./pages/Workforce";
import ClashTracking from "./pages/ClashTracking";
import BimViewer from "./pages/BimViewer";
import CompareResult from "./pages/CompareResult";
import NotFound from "./pages/NotFound";
import { AppLayout } from "./components/layout/AppLayout";
import { cleanupOldResults } from "@/lib/compareResultStore";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    cleanupOldResults();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/auth" replace />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/compare-result" element={<CompareResult />} />
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/admin-dashboard" element={<AdminDashboard />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/scan-qr" element={<QRScanner />} />
              <Route path="/activity" element={<Activity />} />
              <Route path="/pdf-tools" element={<PdfTools />} />
              <Route path="/cad" element={<CadViewer />} />
              <Route path="/workforce" element={<Workforce />} />
              <Route path="/clash-tracking" element={<ClashTracking />} />
              <Route path="/bim-viewer" element={<BimViewer />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
