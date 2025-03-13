
import { useState, useEffect } from 'react';

type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const breakpointValues: Record<Breakpoint, number> = {
  'xs': 0,
  'sm': 640,
  'md': 768,
  'lg': 1024,
  'xl': 1280,
  '2xl': 1536
};

export function useBreakpoint() {
  const [currentBreakpoint, setCurrentBreakpoint] = useState<Breakpoint>('lg');
  const [width, setWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1024);
  
  useEffect(() => {
    const handleResize = () => {
      const newWidth = window.innerWidth;
      setWidth(newWidth);
      
      // Determine current breakpoint
      if (newWidth < breakpointValues.sm) {
        setCurrentBreakpoint('xs');
      } else if (newWidth < breakpointValues.md) {
        setCurrentBreakpoint('sm');
      } else if (newWidth < breakpointValues.lg) {
        setCurrentBreakpoint('md');
      } else if (newWidth < breakpointValues.xl) {
        setCurrentBreakpoint('lg');
      } else if (newWidth < breakpointValues['2xl']) {
        setCurrentBreakpoint('xl');
      } else {
        setCurrentBreakpoint('2xl');
      }
    };
    
    // Set initial values
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const isXs = width < breakpointValues.sm;
  const isSm = width >= breakpointValues.sm && width < breakpointValues.md;
  const isMd = width >= breakpointValues.md && width < breakpointValues.lg;
  const isLg = width >= breakpointValues.lg && width < breakpointValues.xl;
  const isXl = width >= breakpointValues.xl && width < breakpointValues['2xl'];
  const is2Xl = width >= breakpointValues['2xl'];
  
  const isMobile = width < breakpointValues.md;
  const isTablet = width >= breakpointValues.md && width < breakpointValues.lg;
  const isDesktop = width >= breakpointValues.lg;
  
  return {
    width,
    currentBreakpoint,
    isXs,
    isSm,
    isMd,
    isLg,
    isXl,
    is2Xl,
    isMobile,
    isTablet,
    isDesktop
  };
}
