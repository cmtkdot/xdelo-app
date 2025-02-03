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
      <div className="flex h-[calc(100vh-4rem)]">
        <AppSidebar />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
};