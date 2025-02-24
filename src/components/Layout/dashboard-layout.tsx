import { AppSidebar } from "@/components/Layout/app-sidebar";

export interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AppSidebar />
      <main className="transition-all duration-300 ease-in-out pl-16 min-h-screen">
        <div className="container py-6 px-4 mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
