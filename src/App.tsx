import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import { DashboardLayout } from './components/Layout/DashboardLayout';
import Dashboard from './pages/Dashboard';
import ProductGallery from './pages/ProductGallery';
import Settings from './pages/Settings';
import Vendors from './pages/Vendors';
import MessageManager from './pages/MessageManager';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<DashboardLayout><Outlet /></DashboardLayout>}>
          <Route index element={<Dashboard />} />
          <Route path="products" element={<ProductGallery />} />
          <Route path="messages" element={<MessageManager />} />
          <Route path="vendors" element={<Vendors />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;