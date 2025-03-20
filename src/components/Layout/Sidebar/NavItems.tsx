<<<<<<< HEAD
import React from "react";
=======

import React from 'react';
>>>>>>> newmai
import { 
  LayoutDashboard, 
  MessageSquare, 
  Package, 
  Settings, 
<<<<<<< HEAD
  Database, 
  Zap, 
  Music,
  GalleryHorizontal,
  LucideIcon,
  Table
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItem {
  name: string;
  Icon: LucideIcon;
  path: string;
  group?: 'main' | 'data' | 'settings';
  divider?: boolean;
}
=======
  GitCompare, 
  Users, 
  Database,
  GitPullRequest
} from 'lucide-react';
>>>>>>> newmai

interface NavItemsProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  isExpanded?: boolean;
  isMobile?: boolean;
}

<<<<<<< HEAD
export const navItems: NavItem[] = [
  { name: "Dashboard", Icon: Home, path: "/", group: "main" },
  { name: "Messages", Icon: PanelTopOpen, path: "/messages-enhanced", group: "main" },
  { name: "Gallery", Icon: ImageIcon, path: "/gallery", group: "main" },
  { name: "Public Gallery", Icon: GalleryHorizontal, path: "/p/public", group: "main" },
  
  { name: "Media Table", Icon: PanelLeft, path: "/media-table", group: "data", divider: true },
  { name: "Table Demo", Icon: Table, path: "/table-demo", group: "data" },
  { name: "SQL Console", Icon: Database, path: "/sql-console", group: "data" },
  { name: "AI Chat", Icon: FileText, path: "/ai-chat", group: "data" },
  { name: "Audio Upload", Icon: Music, path: "/audio-upload", group: "data" },
  { name: "Make Automations", Icon: Zap, path: "/make-automations", group: "data" },
  
  { name: "Settings", Icon: Settings, path: "/settings", group: "settings", divider: true },
];
=======
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
>>>>>>> newmai

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
