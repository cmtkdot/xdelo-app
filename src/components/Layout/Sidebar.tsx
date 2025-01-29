import { Home, MessageSquare, Package, Settings, Users } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Messages", href: "/messages", icon: MessageSquare },
  { name: "Products", href: "/products", icon: Package },
  { name: "Vendors", href: "/vendors", icon: Users },
  { name: "Settings", href: "/settings", icon: Settings },
];

export const Sidebar = () => {
  const location = useLocation();

  return (
    <div className="flex flex-col w-64 border-r bg-white">
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-md ${
                isActive
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <item.icon
                className={`mr-3 h-5 w-5 ${
                  isActive ? "text-gray-900" : "text-gray-400"
                }`}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};