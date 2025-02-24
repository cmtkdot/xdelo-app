import { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/Theme/ThemeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { supabase } from "./integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/Layout/app-sidebar";

// Lazy load routes
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
      staleTime: 1000 * 60, // Data stays fresh for 1 minute
      gcTime: 1000 * 60 * 5, // Keep unused data in cache for 5 minutes
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

// Data prefetching component
const DataPrefetcher = () => {
  const location = useLocation();

  useEffect(() => {
    // Define which queries to prefetch based on the current route
    const prefetchMap: { [key: string]: () => void } = {
      '/': async () => {
        // Prefetch data for the dashboard and common routes
        await Promise.all([
          queryClient.prefetchQuery({
            queryKey: ['media-groups'],
            queryFn: async () => {
              const { data: messages, error } = await supabase
                .from('messages')
                .select('*')
                .order('created_at', { ascending: false });
              if (error) throw error;
              return messages;
            }
          }),
          queryClient.prefetchQuery({
            queryKey: ['messages'],
            queryFn: async () => {
              const { data, error } = await supabase
                .from('messages')
                .select('*')
                .not('analyzed_content', 'is', null)
                .gt('caption', '')
                .order('created_at', { ascending: false });
              if (error) throw error;
              return data;
            }
          }),
          // Prefetch GL products data
          queryClient.prefetchQuery({
            queryKey: ["glapp_products"],
            queryFn: async () => {
              const { data, error } = await supabase
                .from("gl_products")
                .select(`
                  *,
                  messages:messages!gl_products_messages_fkey(
                    public_url,
                    media_group_id
                  )
                `)
                .eq('messages.is_deleted', false)
                .order("created_at", { ascending: false });
              if (error) throw error;
              return data;
            }
          })
        ]);
      },
      '/gallery': async () => {
        await Promise.all([
          queryClient.prefetchQuery({
            queryKey: ['media-groups'],
            queryFn: async () => {
              const { data, error } = await supabase
                .from('messages')
                .select('*')
                .order('created_at', { ascending: false });
              if (error) throw error;
              return data;
            }
          }),
          // Also prefetch products for potential product linking
          queryClient.prefetchQuery({
            queryKey: ["glapp_products"],
            queryFn: async () => {
              const { data, error } = await supabase
                .from("gl_products")
                .select('*')
                .order("created_at", { ascending: false });
              if (error) throw error;
              return data;
            }
          })
        ]);
      },
      '/media-table': async () => {
        await queryClient.prefetchQuery({
          queryKey: ['messages'],
          queryFn: async () => {
            const { data, error } = await supabase
              .from('messages')
              .select('*')
              .not('analyzed_content', 'is', null)
              .gt('caption', '')
              .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
          }
        });
      },
      '/p/:id': async () => {
        // For public gallery route, prefetch public messages
        await queryClient.prefetchQuery({
          queryKey: ['public-messages'],
          queryFn: async () => {
            const { data, error } = await supabase
              .from('messages')
              .select('*')
              .eq('processing_state', 'completed')
              .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
          }
        });
      }
    };

    const prefetchData = prefetchMap[location.pathname];
    if (prefetchData) {
      prefetchData();
    }
  }, [location]);

  return null;
};

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
          <DataPrefetcher />
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
