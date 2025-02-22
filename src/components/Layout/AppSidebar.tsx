
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageCircle,
  MessageSquare,
  Package,
  Bot,
  Settings,
  LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: MessageCircle, label: 'Messages', path: '/messages' },
  { icon: MessageSquare, label: 'Product Gallery', path: '/gallery' },
  { icon: Package, label: 'Vendors', path: '/vendors' },
  { icon: Bot, label: 'AI Chat', path: '/ai-chat' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export function AppSidebar() {
  const location = useLocation();
  const [isExpanded, setIsExpanded] = React.useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div 
      className={cn(
        "fixed left-0 top-0 h-full bg-white dark:bg-gray-900 transition-all duration-300 ease-in-out z-50",
        isExpanded ? "w-64" : "w-16",
        "border-r border-gray-200 dark:border-gray-800"
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className="flex flex-col h-full py-4">
        <div className="flex items-center justify-center h-16 px-4">
          {isExpanded ? (
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">XDELO</h1>
          ) : (
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">X</h1>
          )}
        </div>

        <nav className="flex-1 px-2 space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center px-2 py-2 text-sm font-medium rounded-md transition-all duration-150 ease-in-out group",
                  isActive 
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-200" 
                    : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                )}
              >
                <Icon className={cn(
                  "flex-shrink-0 w-6 h-6 mr-3 transition-colors duration-150",
                  isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-400 group-hover:text-gray-500 dark:text-gray-400"
                )} />
                <motion.span
                  initial={false}
                  animate={{ opacity: isExpanded ? 1 : 0, width: isExpanded ? 'auto' : 0 }}
                  transition={{ duration: 0.2 }}
                  className="whitespace-nowrap overflow-hidden"
                >
                  {item.label}
                </motion.span>
              </Link>
            );
          })}
        </nav>

        <div className="px-2">
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center w-full px-2 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800 transition-all duration-150 ease-in-out group",
            )}
          >
            <LogOut className="flex-shrink-0 w-6 h-6 mr-3 text-gray-400 group-hover:text-gray-500 dark:text-gray-400" />
            <motion.span
              initial={false}
              animate={{ opacity: isExpanded ? 1 : 0, width: isExpanded ? 'auto' : 0 }}
              transition={{ duration: 0.2 }}
              className="whitespace-nowrap overflow-hidden"
            >
              Logout
            </motion.span>
          </button>
        </div>
      </div>
    </div>
  );
}
