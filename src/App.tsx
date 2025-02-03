import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/react-query";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import Dashboard from "@/pages/Dashboard";
import ProductGallery from "@/pages/ProductGallery";
import MessageManager from "@/pages/MessageManager";
import Settings from "@/pages/Settings";
import Vendors from "@/pages/Vendors";
import { Toaster } from "@/components/ui/toaster";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="messages" element={<MessageManager />} />
            <Route path="gallery" element={<ProductGallery />} />
            <Route path="settings" element={<Settings />} />
            <Route path="vendors" element={<Vendors />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;