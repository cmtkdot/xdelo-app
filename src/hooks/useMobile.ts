import { useState, useEffect } from 'react';

/**
 * Custom hook to detect if the current device is a mobile device based on screen width
 * @returns {boolean} isMobile - Whether the current device is considered a mobile device
 */
export function useIsMobile(): boolean {
  // Default to desktop for server rendering
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    // Handler to call on window resize
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Call handler right away so state gets updated with initial window size
    handleResize();
    
    // Remove event listener on cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []); // Empty array ensures effect runs only on mount and unmount

  return isMobile;
}
