import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import Dashboard from "@/pages/Dashboard";
import ProductGallery from "@/pages/ProductGallery";
import Settings from "@/pages/Settings";
import Vendors from "@/pages/Vendors";
import GlideSync from "@/pages/GlideSync";
import NotFound from "@/pages/NotFound";
import { ThemeProvider } from "@/components/Theme/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="gallery" element={<ProductGallery />} />
            <Route path="vendors" element={<Vendors />} />
            <Route path="settings" element={<Settings />} />
            <Route path="glide-sync" element={<GlideSync />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Router>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;