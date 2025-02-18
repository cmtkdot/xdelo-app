import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { DashboardLayout } from "./components/Layout/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import ProductGallery from "./pages/ProductGallery";
import MediaTable from "./pages/MediaTable";
import PublicGallery from "./pages/PublicGallery";
import Vendors from "./pages/Vendors";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AIChat from "./pages/AIChat";
import GlProducts from "./pages/GlProducts";
import AudioUpload from "./pages/AudioUpload";
import { useEffect, useState } from "react";
import { supabase } from "./integrations/supabase/client";
import { ThemeProvider } from "./components/Theme/ThemeProvider";
import { Session } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar/Sidebar";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.status === 401 || error?.message?.includes('Invalid Refresh Token')) {
          return false;
        }
        return failureCount < 3;
      },
      meta: {
        errorHandler: (error: any) => {
          if (error?.status === 401 || error?.message?.includes('Invalid Refresh Token')) {
            window.location.href = '/auth';
          }
        }
      }
    }
  }
});

const ProtectedRoute = ({
  children
}: {
  children: React.ReactNode;
}) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      setSession(session);
      setLoading(false);
      if (!session) {
        navigate('/auth');
      }
    });

    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'SIGNED_OUT' || _event === 'TOKEN_REFRESHED' && !session) {
        setSession(null);
        navigate('/auth');
      } else {
        setSession(session);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>;
  }

  if (!session) {
    return null;
  }

  return children;
};

const App = () => <ThemeProvider defaultTheme="system" storageKey="xdelo-theme">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/p/:id" element={<PublicGallery />} />
            <Route element={<ProtectedRoute>
                  <div className="h-full relative">
                    <div className="hidden h-full md:flex md:w-72 md:flex-col md:fixed md:inset-y-0 z-[80] bg-gray-900">
                      <Sidebar />
                    </div>
                    <main className="md:pl-72 min-h-screen bg-background">
                      <div className="container py-[20px] px-[50px] mx-0 bg-slate-50">
                        <Outlet />
                      </div>
                    </main>
                  </div>
                </ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/gallery" element={<ProductGallery />} />
              <Route path="/media-table" element={<MediaTable />} />
              <Route path="/ai-chat" element={<AIChat />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/audio-upload" element={<AudioUpload />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
          <Toaster />
          <Sonner />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>;

export default App;
