
import React from 'react';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Package, 
  Settings, 
  GitCompare, 
  Users, 
  Database,
  GitPullRequest
} from 'lucide-react';

interface NavItemsProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  isExpanded?: boolean;
  isMobile?: boolean;
}

export const NavItems: React.FC<NavItemsProps> = ({ currentPath, onNavigate, isExpanded = true, isMobile = false }) => {
  const items = [
    { 
      title: 'Dashboard', 
      href: '/', 
      icon: <LayoutDashboard size={20} />,
      isActive: currentPath === '/' 
    },
    { 
      title: 'Messages', 
      href: '/messages-enhanced', 
      icon: <MessageSquare size={20} />, 
      isActive: currentPath === '/messages-enhanced' 
    },
    { 
      title: 'Products', 
      href: '/gl-products', 
      icon: <Package size={20} />, 
      isActive: currentPath === '/gl-products' 
    },
    { 
      title: 'Vendors', 
      href: '/vendors', 
      icon: <Users size={20} />, 
      isActive: currentPath === '/vendors' 
    },
    { 
      title: 'Product Matching', 
      href: '/product-matching', 
      icon: <GitCompare size={20} />, 
      isActive: currentPath === '/product-matching' 
    },
    { 
      title: 'SQL Console', 
      href: '/sql-console', 
      icon: <Database size={20} />, 
      isActive: currentPath === '/sql-console' 
    },
    { 
      title: 'Settings', 
      href: '/settings', 
      icon: <Settings size={20} />, 
      isActive: currentPath === '/settings' 
    },
  ];

  return (
    <div className="space-y-1">
      {items.map((item) => (
        <button
          key={item.href}
          onClick={() => onNavigate(item.href)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
            item.isActive
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted"
          }`}
        >
          {item.icon}
          {(isExpanded || isMobile) && <span>{item.title}</span>}
        </button>
      ))}
    </div>
  );
};
