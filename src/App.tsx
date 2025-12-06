import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { NotificationProvider } from "@/components/NotificationProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Users from "./pages/Users";
import Streams from "./pages/Streams";
import Servers from "./pages/Servers";
import Settings from "./pages/Settings";
import Database from "./pages/Database";
import Activity from "./pages/Activity";
import Security from "./pages/Security";
import VOD from "./pages/VOD";
import EPG from "./pages/EPG";
import Series from "./pages/Series";
import Resellers from "./pages/Resellers";
import Connections from "./pages/Connections";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
              <Route path="/streams" element={<ProtectedRoute><Streams /></ProtectedRoute>} />
              <Route path="/vod" element={<ProtectedRoute><VOD /></ProtectedRoute>} />
              <Route path="/series" element={<ProtectedRoute><Series /></ProtectedRoute>} />
              <Route path="/epg" element={<ProtectedRoute><EPG /></ProtectedRoute>} />
              <Route path="/resellers" element={<ProtectedRoute><Resellers /></ProtectedRoute>} />
              <Route path="/connections" element={<ProtectedRoute><Connections /></ProtectedRoute>} />
              <Route path="/servers" element={<ProtectedRoute><Servers /></ProtectedRoute>} />
              <Route path="/database" element={<ProtectedRoute><Database /></ProtectedRoute>} />
              <Route path="/activity" element={<ProtectedRoute><Activity /></ProtectedRoute>} />
              <Route path="/security" element={<ProtectedRoute><Security /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
