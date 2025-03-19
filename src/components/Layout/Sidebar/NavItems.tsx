
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
import { useLocation } from "react-router-dom";

export const NavItems = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const navItems = [
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

  return navItems;
};
