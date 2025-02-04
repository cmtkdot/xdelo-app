import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Images, 
  Settings,
  Users,
  RefreshCw
} from "lucide-react";

const AppSidebar = ({ className }: { className?: string }) => {
  const location = useLocation();
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <div className={cn("pb-12", className)}>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <div className="space-y-1">
            <Link to="/">
              <Button
                variant={isActive("/") ? "secondary" : "ghost"}
                className="w-full justify-start"
              >
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            <Link to="/gallery">
              <Button
                variant={isActive("/gallery") ? "secondary" : "ghost"}
                className="w-full justify-start"
              >
                <Images className="mr-2 h-4 w-4" />
                Product Gallery
              </Button>
            </Link>
            <Link to="/vendors">
              <Button
                variant={isActive("/vendors") ? "secondary" : "ghost"}
                className="w-full justify-start"
              >
                <Users className="mr-2 h-4 w-4" />
                Vendors
              </Button>
            </Link>
            <Link to="/glide-sync">
              <Button
                variant={isActive("/glide-sync") ? "secondary" : "ghost"}
                className="w-full justify-start"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Glide Sync
              </Button>
            </Link>
            <Link to="/settings">
              <Button
                variant={isActive("/settings") ? "secondary" : "ghost"}
                className="w-full justify-start"
              >
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppSidebar;