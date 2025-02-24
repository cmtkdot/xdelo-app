import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Home,
  Settings,
  Image,
  MessageSquare,
  Table,
  Upload,
  Package,
  Bot
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Messages", href: "/messages", icon: MessageSquare },
  { name: "Gallery", href: "/gallery", icon: Image },
  { name: "Media Table", href: "/media-table", icon: Table },
  { name: "GL Products", href: "/gl-products", icon: Package },
  { name: "AI Chat", href: "/ai-chat", icon: Bot },
  { name: "Audio Upload", href: "/audio-upload", icon: Upload },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <div className="fixed inset-y-0 left-0 z-50 flex w-16 flex-col">
      {/* Sidebar component */}
      <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-6 pb-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex h-16 shrink-0 items-center">
          <img
            className="h-8 w-auto"
            src="/logo.svg"
            alt="Your Company"
          />
        </div>
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <li>
              <ul role="list" className="-mx-2 space-y-1">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <li key={item.name}>
                      <Link
                        to={item.href}
                        className={cn(
                          isActive
                            ? "bg-gray-50 text-primary dark:bg-gray-800"
                            : "text-gray-700 hover:text-primary hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800",
                          "group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold"
                        )}
                      >
                        <item.icon
                          className={cn(
                            isActive 
                              ? "text-primary" 
                              : "text-gray-400 group-hover:text-primary dark:text-gray-500",
                            "h-6 w-6 shrink-0"
                          )}
                          aria-hidden="true"
                        />
                        <span className="sr-only">{item.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}
