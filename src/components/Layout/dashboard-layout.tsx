
import { AppSidebar } from "@/components/Layout/app-sidebar";

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
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
