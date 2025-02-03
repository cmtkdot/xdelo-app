import React from "react";
import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { AppSidebar } from "./AppSidebar";

export const DashboardLayout = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex min-h-[calc(100vh-4rem)] relative">
        <AppSidebar />
        <main className="flex-1 p-4 md:p-6 w-full overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};