
import { useState } from "react";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import { LayoutDashboard, MessageSquare, Package, Settings, LogOut, Bot } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export function AppSidebar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
      
      navigate("/auth");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const links = [
    {
      label: "Dashboard",
      href: "/",
      icon: <LayoutDashboard className="text-[#0066FF] h-5 w-5 flex-shrink-0" />,
      onClick: () => navigate("/")
    },
    {
      label: "Product Gallery",
      href: "/gallery",
      icon: <MessageSquare className="text-[#0066FF] h-5 w-5 flex-shrink-0" />,
      onClick: () => navigate("/gallery")
    },
    {
      label: "Vendors",
      href: "/vendors",
      icon: <Package className="text-[#0066FF] h-5 w-5 flex-shrink-0" />,
      onClick: () => navigate("/vendors")
    },
    {
      label: "AI Chat",
      href: "/ai-chat",
      icon: <Bot className="text-[#0066FF] h-5 w-5 flex-shrink-0" />,
      onClick: () => navigate("/ai-chat")
    },
    {
      label: "Settings",
      href: "/settings",
      icon: <Settings className="text-[#0066FF] h-5 w-5 flex-shrink-0" />,
      onClick: () => navigate("/settings")
    },
    {
      label: "Logout",
      href: "#",
      icon: <LogOut className="text-[#0066FF] h-5 w-5 flex-shrink-0" />,
      onClick: handleLogout
    },
  ];

  return (
    <Sidebar open={open} setOpen={setOpen}>
      <SidebarBody className="justify-between gap-10">
        <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mt-8 flex flex-col gap-2">
            {links.map((link, idx) => (
              <SidebarLink 
                key={idx} 
                link={link}
              />
            ))}
          </div>
        </div>
      </SidebarBody>
    </Sidebar>
  );
}
