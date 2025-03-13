import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Home,
  MessageSquare,
  Image as ImageIcon,
  FileText,
  Settings,
} from "lucide-react";

export const MobileBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { name: "Home", Icon: Home, path: "/" },
    { name: "Messages", Icon: MessageSquare, path: "/messages" },
    { name: "Gallery", Icon: ImageIcon, path: "/gallery" },
    { name: "AI Chat", Icon: FileText, path: "/ai-chat" },
    { name: "Settings", Icon: Settings, path: "/settings" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 md:hidden z-40">
      <div className="grid grid-cols-5 h-full">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              className={cn(
                "flex flex-col items-center justify-center space-y-1",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
              onClick={() => navigate(item.path)}
            >
              <item.Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
