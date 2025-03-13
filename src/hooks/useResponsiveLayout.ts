
import { useState, useEffect } from 'react';
import { useBreakpoint } from './useBreakpoint';

interface ResponsiveLayoutOptions {
  defaultSidebarOpen?: boolean;
  defaultDetailsPanelOpen?: boolean;
  defaultAnalyticsOpen?: boolean;
  defaultView?: 'grid' | 'list';
  persistKey?: string; // Key for localStorage
}

export function useResponsiveLayout({
  defaultSidebarOpen = true,
  defaultDetailsPanelOpen = false,
  defaultAnalyticsOpen = false,
  defaultView = 'grid',
  persistKey
}: ResponsiveLayoutOptions = {}) {
  const { isMobile, isTablet, isDesktop } = useBreakpoint();
  
  // Initialize state based on screen size and saved preferences
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (persistKey) {
      const saved = localStorage.getItem(`${persistKey}-sidebar`);
      if (saved !== null) return saved === 'true';
    }
    return isDesktop ? defaultSidebarOpen : false;
  });
  
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(() => {
    if (persistKey) {
      const saved = localStorage.getItem(`${persistKey}-details`);
      if (saved !== null) return saved === 'true';
    }
    return isDesktop ? defaultDetailsPanelOpen : false;
  });
  
  const [analyticsOpen, setAnalyticsOpen] = useState(() => {
    if (persistKey) {
      const saved = localStorage.getItem(`${persistKey}-analytics`);
      if (saved !== null) return saved === 'true';
    }
    return isDesktop ? defaultAnalyticsOpen : false;
  });
  
  const [currentView, setCurrentView] = useState<'grid' | 'list'>(() => {
    if (persistKey) {
      const saved = localStorage.getItem(`${persistKey}-view`);
      if (saved === 'grid' || saved === 'list') return saved;
    }
    // Mobile defaults to list view, desktop to grid
    return isMobile ? 'list' : defaultView;
  });
  
  // Update layout when screen size changes
  useEffect(() => {
    if (isMobile) {
      // On mobile, close sidebar and details panel by default
      if (sidebarOpen) setSidebarOpen(false);
      if (detailsPanelOpen && analyticsOpen) {
        // Don't have both panels open on mobile
        setAnalyticsOpen(false);
      }
    }
  }, [isMobile, isTablet, isDesktop]);
  
  // Save preferences if persistKey is provided
  useEffect(() => {
    if (persistKey) {
      localStorage.setItem(`${persistKey}-sidebar`, String(sidebarOpen));
      localStorage.setItem(`${persistKey}-details`, String(detailsPanelOpen));
      localStorage.setItem(`${persistKey}-analytics`, String(analyticsOpen));
      localStorage.setItem(`${persistKey}-view`, currentView);
    }
  }, [persistKey, sidebarOpen, detailsPanelOpen, analyticsOpen, currentView]);
  
  return {
    isMobile,
    isTablet,
    isDesktop,
    sidebarOpen,
    setSidebarOpen,
    detailsPanelOpen,
    setDetailsPanelOpen,
    analyticsOpen,
    setAnalyticsOpen,
    currentView,
    setCurrentView,
    
    // Utility functions
    toggleSidebar: () => setSidebarOpen(prev => !prev),
    toggleDetailsPanel: () => setDetailsPanelOpen(prev => !prev),
    toggleAnalytics: () => setAnalyticsOpen(prev => !prev),
    toggleView: () => setCurrentView(prev => prev === 'grid' ? 'list' : 'grid')
  };
}
