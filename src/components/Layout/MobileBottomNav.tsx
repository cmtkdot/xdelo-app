
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useIsMobile } from '@/hooks/useMobile';
import { cn } from '@/lib/utils';
import { Home, MessageSquare, Image, Settings, PanelTopOpen } from 'lucide-react';

export function MobileBottomNav() {
  const location = useLocation();
  const isMobile = useIsMobile();
  
  // Only show on mobile
  if (!isMobile) return null;
  
  const navItems = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Messages', path: '/messages', icon: MessageSquare },
    { name: 'Enhanced', path: '/messages-enhanced', icon: PanelTopOpen },
    { name: 'Gallery', path: '/gallery', icon: Image },
    { name: 'Settings', path: '/settings', icon: Settings }
  ];
  
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
      <div className="grid grid-cols-5 h-16">
        {navItems.map(item => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn(
                'h-5 w-5 mb-1',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )} />
              <span className="text-xs font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
