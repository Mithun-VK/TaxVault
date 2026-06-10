import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import Shell from '@/components/Shell';

// Import pages directly
import LoginPage from '@/pages/Login';
import DashboardPage from '@/pages/Dashboard';
import ObligationsPage from '@/pages/Obligations';
import PaymentsPage from '@/pages/Payments';
import DocumentsPage from '@/pages/Documents';
import AlertSettingsPage from '@/pages/AlertSettings';
import ProfilePage from '@/pages/Profile';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = useAuthStore((state) => state.accessToken);
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Shell />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="obligations" element={<ObligationsPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="alerts" element={<AlertSettingsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
export default App;
