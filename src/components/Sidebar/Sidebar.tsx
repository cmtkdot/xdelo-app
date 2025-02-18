
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  MessageSquare,
  Image,
  LayoutGrid,
  Store,
  Settings,
  Globe,
  Mic,
} from "lucide-react";

const routes = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/",
    color: "text-sky-500",
  },
  {
    label: "Media Table",
    icon: Image,
    href: "/media-table",
    color: "text-pink-700",
  },
  {
    label: "Product Gallery",
    icon: Store,
    href: "/gallery",
    color: "text-violet-500",
  },
  {
    label: "Audio Upload",
    icon: Mic,
    href: "/audio-upload",
    color: "text-green-500",
  },
  {
    label: "AI Chat",
    icon: MessageSquare,
    href: "/ai-chat",
    color: "text-yellow-500",
  },
  {
    label: "Settings",
    icon: Settings,
    href: "/settings",
  },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <div className="space-y-4 py-4 flex flex-col h-full bg-[#111827] text-white">
      <div className="px-3 py-2 flex-1">
        <Link to="/" className="flex items-center pl-3 mb-14">
          <h1 className="text-2xl font-bold">
            Xdelo
          </h1>
        </Link>
        <div className="space-y-1">
          {routes.map((route) => (
            <Link
              key={route.href}
              to={route.href}
              className={cn(
                "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-lg transition",
                location.pathname === route.href 
                  ? "text-white bg-white/10" 
                  : "text-zinc-400",
              )}
            >
              <div className="flex items-center flex-1">
                <route.icon className={cn("h-5 w-5 mr-3", route.color)} />
                {route.label}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
