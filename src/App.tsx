
import { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/Theme/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { supabase } from "./integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/Layout/app-sidebar";

// Lazy load routes with preload function
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ProductGallery = lazy(() => import("./pages/ProductGallery"));
const MediaTable = lazy(() => import("./pages/MediaTable"));
const PublicGallery = lazy(() => import("./pages/PublicGallery"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AIChat = lazy(() => import("./pages/AIChat"));
const GlProducts = lazy(() => import("./pages/GlProducts"));
const AudioUpload = lazy(() => import("./pages/AudioUpload"));
const MessagesPage = lazy(() => import("./pages/Messages"));

// Preload function for commonly accessed routes
const preloadRoutes = () => {
  // Start preloading main routes after initial render
  const preloadQueue = [
    () => import("./pages/Dashboard"),
    () => import("./pages/ProductGallery"),
    () => import("./pages/MediaTable")
  ];

  let currentIndex = 0;

  const preloadNext = () => {
    if (currentIndex < preloadQueue.length) {
      const nextPreload = preloadQueue[currentIndex];
      currentIndex++;
      nextPreload().then(() => {
        // Wait a bit before loading the next route to avoid overwhelming the browser
        setTimeout(preloadNext, 1000);
      });
    }
  };

  // Start preloading
  preloadNext();
};

// Route preloader component
const RoutePreloader = () => {
  const location = useLocation();

  useEffect(() => {
    // Preload next likely routes based on current route
    const preloadMap: { [key: string]: (() => Promise<any>)[] } = {
      '/': [
        () => import("./pages/ProductGallery"),
        () => import("./pages/MediaTable")
      ],
      '/gallery': [
        () => import("./pages/MediaTable"),
        () => import("./pages/Dashboard")
      ],
      '/media-table': [
        () => import("./pages/ProductGallery"),
        () => import("./pages/Dashboard")
      ]
    };

    const routesToPreload = preloadMap[location.pathname];
    if (routesToPreload) {
      routesToPreload.forEach(preloadRoute => {
        preloadRoute();
      });
    }
  }, [location]);

  return null;
};

interface ApiError {
  status?: number;
  message?: string;
}

const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
  </div>
);

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
      } else {
        // Start preloading routes after successful auth
        preloadRoutes();
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
    return <LoadingSpinner />;
  }

  if (!session) {
    return null;
  }

  return children;
};

const App = () => (
  <ThemeProvider defaultTheme="system" storageKey="xdelo-theme">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router>
          <RoutePreloader />
          <Suspense fallback={<LoadingSpinner />}>
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
          </Suspense>
          <Toaster />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
