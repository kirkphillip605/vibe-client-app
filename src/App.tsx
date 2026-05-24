import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import DashboardPage from '@/pages/DashboardPage';
import EventCreatePage from '@/pages/EventCreatePage';
import ClientPortalPage from '@/pages/ClientPortalPage';
import LandingPage from '@/pages/LandingPage';
import { useAuth } from '@/contexts/AuthContext';

function PrivateRoute({ children }: { children: JSX.Element }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Public Digital-Code Input Landing Page */}
      <Route path="/" element={<LandingPage />} />
      
      {/* Public Auth Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Authenticated DJ Admin Dashboard Routes */}
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <DashboardPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/events/new"
        element={
          <PrivateRoute>
            <EventCreatePage />
          </PrivateRoute>
        }
      />

      {/* Public Code-Protected Client Portal */}
      <Route path="/event/:code" element={<ClientPortalPage />} />
      
      {/* Fallback to code landing page */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
