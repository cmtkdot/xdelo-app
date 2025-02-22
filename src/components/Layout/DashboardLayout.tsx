import React from "react";
import { Header } from "./Header";
import { AppSidebar } from "./AppSidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex min-h-[calc(100vh-4rem)] relative">
        <AppSidebar />
        <main className="flex-1 p-4 md:p-6 w-full overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};