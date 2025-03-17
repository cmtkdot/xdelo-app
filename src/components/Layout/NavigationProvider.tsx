
import React, { createContext, useContext, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useIsMobile } from '@/hooks/useMobile';

type NavigationContextType = {
  isOpen: boolean;
  openNavigation: () => void;
  closeNavigation: () => void;
  toggleNavigation: () => void;
  title: string;
  setTitle: (title: string) => void;
  showBackButton: boolean;
  setShowBackButton: (show: boolean) => void;
  breadcrumbs: { label: string; path: string }[];
  setBreadcrumbs: (breadcrumbs: { label: string; path: string }[]) => void;
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
};

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('XDELO');
  const [showBackButton, setShowBackButton] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState<{ label: string; path: string }[]>([]);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const location = useLocation();
  const isMobile = useIsMobile();

  // Close navigation drawer when route changes on mobile
  React.useEffect(() => {
    if (isMobile) {
      setIsOpen(false);
    }
  }, [location.pathname, isMobile]);

  const openNavigation = () => setIsOpen(true);
  const closeNavigation = () => setIsOpen(false);
  const toggleNavigation = () => setIsOpen(prev => !prev);
  const toggleSidebar = () => setSidebarCollapsed(prev => !prev);

  const value = {
    isOpen,
    openNavigation,
    closeNavigation,
    toggleNavigation,
    title,
    setTitle,
    showBackButton,
    setShowBackButton,
    breadcrumbs,
    setBreadcrumbs,
    isSidebarCollapsed,
    toggleSidebar,
    setSidebarCollapsed,
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}; 
