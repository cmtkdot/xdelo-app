
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useNavigate } from "react-router-dom";
import { SupabaseProvider } from "./integrations/supabase/SupabaseProvider";
import { ThemeProvider } from "./components/Theme/ThemeProvider";
import { useState, useEffect } from "react";
import { supabase } from "./integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import MessagesPage from "./pages/Messages";
import ProductGallery from "./pages/ProductGallery";
import MediaTable from "./pages/MediaTable";
import AIChat from "./pages/AIChat";
import Settings from "./pages/Settings";
import AudioUpload from "./pages/AudioUpload";
import NotFound from "./pages/NotFound";
import PublicGallery from "./pages/PublicGallery";
import AppSidebar from "./components/Layout/AppSidebar";

interface ApiError extends Error {
  status?: number;
  message?: string;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: ApiError) => {
        if (error?.status === 401 || error?.message?.includes('Invalid Refresh Token')) {
          return false;
        }
        return failureCount < 3;
      },
      meta: {
        errorHandler: (error: ApiError) => {
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
      if (_event === 'SIGNED_OUT' || (_event === 'TOKEN_REFRESHED' && !session)) {
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

const App = () => (
  <SupabaseProvider>
    <ThemeProvider defaultTheme="system" storageKey="xdelo-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Router>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/p/:id" element={<PublicGallery />} />
              <Route element={
                <ProtectedRoute>
                  <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
                    <AppSidebar />
                    <main className="transition-all duration-300 ease-in-out pl-16 min-h-screen">
                      <div className="container py-6 px-4 mx-auto">
                        <Outlet />
                      </div>
                    </main>
                  </div>
                </ProtectedRoute>
              }>
                <Route path="/" element={<Dashboard />} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/gallery" element={<ProductGallery />} />
                <Route path="/media-table" element={<MediaTable />} />
                <Route path="/ai-chat" element={<AIChat />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/audio-upload" element={<AudioUpload />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Router>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </SupabaseProvider>
);

export default App;
