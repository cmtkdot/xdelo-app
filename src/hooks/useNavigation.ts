
import { create } from 'zustand';
import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useIsMobile } from './useMobile';

type NavigationState = {
  isOpen: boolean;
  toggleNavigation: () => void;
  openNavigation: () => void;
  closeNavigation: () => void;
  title: string;
  setTitle: (title: string) => void;
  showBackButton: boolean;
  setShowBackButton: (show: boolean) => void;
  breadcrumbs: { label: string; path: string }[];
  setBreadcrumbs: (breadcrumbs: { label: string; path: string }[]) => void;
};

export const useNavigationStore = create<NavigationState>((set) => ({
  isOpen: false,
  toggleNavigation: () => set((state) => ({ isOpen: !state.isOpen })),
  openNavigation: () => set({ isOpen: true }),
  closeNavigation: () => set({ isOpen: false }),
  title: 'Xdelo',
  setTitle: (title) => set({ title }),
  showBackButton: false,
  setShowBackButton: (show) => set({ showBackButton: show }),
  breadcrumbs: [],
  setBreadcrumbs: (breadcrumbs) => set({ breadcrumbs }),
}));

export function useNavigation() {
  const {
    isOpen,
    toggleNavigation,
    openNavigation,
    closeNavigation,
    title,
    setTitle,
    showBackButton,
    setShowBackButton,
    breadcrumbs,
    setBreadcrumbs,
  } = useNavigationStore();
  
  const location = useLocation();
  const isMobile = useIsMobile();

  // Close navigation drawer when route changes on mobile
  useEffect(() => {
    if (isMobile) {
      closeNavigation();
    }
  }, [location.pathname, isMobile, closeNavigation]);

  return {
    isOpen,
    toggleNavigation,
    openNavigation,
    closeNavigation,
    title,
    setTitle,
    showBackButton,
    setShowBackButton,
    breadcrumbs,
    setBreadcrumbs,
  };
}
