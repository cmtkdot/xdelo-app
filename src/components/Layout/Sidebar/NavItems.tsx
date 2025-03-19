
import { 
  BarChart2, 
  Inbox, 
  Image, 
  Settings, 
  FileAudio, 
  Database, 
  Bot,
  FileText,
  PuzzleIcon,
  PanelLeftClose
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface NavItemProps {
  title: string;
  href: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick?: () => void;
}

interface NavItemsProps {
  currentPath: string;
  onNavigate?: (path: string) => void;
  isExpanded?: boolean;
  isMobile?: boolean;
}

export const NavItems: React.FC<NavItemsProps> = ({ 
  currentPath, 
  onNavigate,
  isExpanded = true,
  isMobile = false
}) => {
  const navItems: NavItemProps[] = [
    {
      title: "Dashboard",
      href: "/",
      icon: <BarChart2 className="h-5 w-5" />,
      isActive: currentPath === "/",
    },
    {
      title: "Messages",
      href: "/messages-enhanced",
      icon: <Inbox className="h-5 w-5" />,
      isActive: currentPath.includes("messages"),
    },
    {
      title: "Products",
      href: "/gallery",
      icon: <Image className="h-5 w-5" />,
      isActive: currentPath === "/gallery",
    },
    {
      title: "Product Matching",
      href: "/product-matching",
      icon: <PuzzleIcon className="h-5 w-5" />,
      isActive: currentPath === "/product-matching",
    },
    {
      title: "Media Table",
      href: "/media-table",
      icon: <FileText className="h-5 w-5" />,
      isActive: currentPath === "/media-table",
    },
    {
      title: "AI Chat",
      href: "/ai-chat",
      icon: <Bot className="h-5 w-5" />,
      isActive: currentPath === "/ai-chat",
    },
    {
      title: "Audio Upload",
      href: "/audio-upload",
      icon: <FileAudio className="h-5 w-5" />,
      isActive: currentPath === "/audio-upload",
    },
    {
      title: "SQL Console",
      href: "/sql-console",
      icon: <Database className="h-5 w-5" />,
      isActive: currentPath === "/sql-console",
    },
    {
      title: "Automations",
      href: "/make-automations",
      icon: <PanelLeftClose className="h-5 w-5" />,
      isActive: currentPath === "/make-automations",
    },
    {
      title: "Settings",
      href: "/settings",
      icon: <Settings className="h-5 w-5" />,
      isActive: currentPath === "/settings",
    },
  ];

  const handleClick = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    }
  };

  return (
    <div className="space-y-1">
      {navItems.map((item) => (
        <div
          key={item.title}
          onClick={() => handleClick(item.href)}
          className={cn(
            "flex items-center px-3 py-2 text-sm rounded-md cursor-pointer transition-colors",
            item.isActive 
              ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white" 
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white",
            isMobile && "mobile-touch-target h-auto min-h-[44px]",
            !isExpanded && !isMobile && "justify-center"
          )}
        >
          <div className={cn("flex-shrink-0", item.isActive ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400")}>
            {item.icon}
          </div>
          {(isExpanded || isMobile) && (
            <span className={cn("ml-3", !isExpanded && "sr-only")}>
              {item.title}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};
