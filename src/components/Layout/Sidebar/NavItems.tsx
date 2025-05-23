import {
  Database,
  FileText,
  GalleryHorizontal,
  ImageIcon,
  LayoutDashboard,
  LucideIcon,
  MessageSquare,
  PanelLeft
} from "lucide-react";
import React from "react";

interface NavItem {
  name: string;
  Icon: LucideIcon;
  path: string;
  group?: "main" | "data" | "settings";
  divider?: boolean;
}

interface NavItemsProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  isExpanded?: boolean;
  isMobile?: boolean;
}

export const NavItems: React.FC<NavItemsProps> = ({
  currentPath,
  onNavigate,
  isExpanded = true,
  isMobile = false,
}) => {
  const items = [
    {
      title: "Dashboard",
      href: "/",
      icon: <LayoutDashboard size={20} />,
      isActive: currentPath === "/",
    },
    {
      title: "Messages",
      href: "/messages-enhanced",
      icon: <MessageSquare size={20} />,
      isActive: currentPath === "/messages-enhanced",
    },
    {
      title: "Gallery",
      href: "/gallery",
      icon: <ImageIcon size={20} />,
      isActive: currentPath === "/gallery",
    },
    {
      title: "Public Gallery",
      href: "/p/public",
      icon: <GalleryHorizontal size={20} />,
      isActive: currentPath === "/p/public",
    },
    {
      title: "Media Table",
      href: "/media-table",
      icon: <PanelLeft size={20} />,
      isActive: currentPath === "/media-table",
    },
    {
      title: "Database",
      href: "/database",
      icon: <Database size={20} />,
      isActive: currentPath === "/database",
    },
    {
      title: "AI Chat",
      href: "/ai-chat",
      icon: <FileText size={20} />,
      isActive: currentPath === "/ai-chat",
    },
    // Settings removed
  ];

  return (
    <div className="space-y-1">
      {items.map((item) => (
        <button
          key={item.href}
          onClick={() => onNavigate(item.href)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${item.isActive
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
