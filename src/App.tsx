
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useNavigate } from "react-router-dom";
import { SupabaseProvider } from "./integrations/supabase/SupabaseProvider";
import { ThemeProvider } from "./components/Theme/ThemeProvider";
import { NavigationProvider } from "./components/Layout/NavigationProvider";
import { useState, useEffect, lazy, Suspense } from "react";
import { supabase } from "./integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import Auth from "./pages/Auth";
import { MobileBottomNav } from "./components/Layout/MobileBottomNav";
import { useIsMobile } from "./hooks/useMobile";

// Lazy load page components for better performance
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MessagesEnhanced = lazy(() => import("./pages/MessagesEnhanced"));
const ProductGallery = lazy(() => import("./pages/ProductGallery"));
const MediaTable = lazy(() => import("./pages/MediaTable"));
const AIChat = lazy(() => import("./pages/AIChat"));
const Settings = lazy(() => import("./pages/Settings"));
const AudioUpload = lazy(() => import("./pages/AudioUpload"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SqlConsole = lazy(() => import('./pages/SqlConsole'));
const MakeAutomations = lazy(() => import('./pages/MakeAutomations'));
const TableDemo = lazy(() => import('./pages/table-demo'));
const ProductMatching = lazy(() => import('./pages/ProductMatching'));

// Load the public gallery - this needs to be accessible without auth
const PublicGallery = lazy(() => import("./pages/PublicGallery"));

import { AppSidebar } from "@/components/Layout/Sidebar";

interface ApiError extends Error {
  status?: number;
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

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
  </div>
);

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
    return <PageLoader />;
  }

  if (!session) {
    return null;
  }

  return children;
};

function App() {
  return (
    <div className="app">
      <SupabaseProvider>
        <ThemeProvider defaultTheme="system" storageKey="xdelo-theme">
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <Router>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  
                  {/* Public routes - accessible without authentication */}
                  <Route path="/p/public" element={
                    <Suspense fallback={<PageLoader />}>
                      <PublicGallery />
                    </Suspense>
                  } />
                  <Route path="/p/:id" element={
                    <Suspense fallback={<PageLoader />}>
                      <PublicGallery />
                    </Suspense>
                  } />
                  
                  {/* Protected routes - require authentication */}
                  <Route element={
                    <ProtectedRoute>
                      <NavigationProvider>
                        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
                          <AppSidebar />
                          <main className="transition-all duration-300 ease-in-out md:pl-16 min-h-screen pt-[4rem] md:pt-4 pb-20 md:pb-4">
                            <div className="container py-6 px-4 mx-auto">
                              <Suspense fallback={<PageLoader />}>
                                <Outlet />
                              </Suspense>
                            </div>
                          </main>
                          <MobileBottomNav />
                        </div>
                      </NavigationProvider>
                    </ProtectedRoute>
                  }>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/messages" element={<Navigate to="/messages-enhanced" replace />} />
                    <Route path="/messages-enhanced" element={<MessagesEnhanced />} />
                    <Route path="/gallery" element={<ProductGallery />} />
                    <Route path="/media-table" element={<MediaTable />} />
                    <Route path="/ai-chat" element={<AIChat />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/audio-upload" element={<AudioUpload />} />
                    <Route path="/sql-console" element={<SqlConsole />} />
                    <Route path="/make-automations" element={<MakeAutomations />} />
                    <Route path="/table-demo" element={<TableDemo />} />
                    <Route path="/product-matching" element={<ProductMatching />} />
                    <Route path="*" element={<NotFound />} />
                  </Route>
                </Routes>
              </Router>
              <Toaster />
            </TooltipProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </SupabaseProvider>
    </div>
  );
}

export default App;
