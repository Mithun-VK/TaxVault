import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/shared/ProtectedRoute';
import { AdminRoute } from '@/components/shared/AdminRoute';
import { Shell } from '@/components/shared/Shell';
import { Login } from '@/pages/Login';
import { Home } from '@/pages/Home';
import { Dashboard } from '@/pages/Dashboard';
import { Properties } from '@/pages/Properties';
import { AssetDetail } from '@/pages/AssetDetail';
import { AssetFormPage } from '@/pages/AssetFormPage';
import { Insurance } from '@/pages/Insurance';
import { InsuranceDetail } from '@/pages/InsuranceDetail';
import { InsuranceFormPage } from '@/pages/InsuranceFormPage';
import { Taxes } from '@/pages/Taxes';
import { TaxDetail } from '@/pages/TaxDetail';
import { TaxFormPage } from '@/pages/TaxFormPage';
import { Bills } from '@/pages/Bills';
import { BillDetail } from '@/pages/BillDetail';
import { BillFormPage } from '@/pages/BillFormPage';
import { Payments } from '@/pages/Payments';
import { Documents } from '@/pages/Documents';
import { DocumentFormPage } from '@/pages/DocumentFormPage';
import { Analytics } from '@/pages/Analytics';
import { Reports } from '@/pages/Reports';
import { Users } from '@/pages/Users';
import { IndividualList } from '@/pages/IndividualList';
import { IndividualDetail } from '@/pages/IndividualDetail';
import { Company } from '@/pages/Company';
import { AlertSettings } from '@/pages/AlertSettings';
import { Profile } from '@/pages/Profile';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Shell />}>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/assets" element={<Properties />} />
          <Route path="/assets/new" element={<AssetFormPage />} />
          <Route path="/assets/:id/edit" element={<AssetFormPage />} />
          <Route path="/assets/:id" element={<AssetDetail />} />
          <Route path="/insurance" element={<Insurance />} />
          <Route path="/insurance/new" element={<InsuranceFormPage />} />
          <Route path="/insurance/:id/edit" element={<InsuranceFormPage />} />
          <Route path="/insurance/:id" element={<InsuranceDetail />} />
          <Route path="/taxes" element={<Taxes />} />
          <Route path="/taxes/new" element={<TaxFormPage />} />
          <Route path="/taxes/:id/edit" element={<TaxFormPage />} />
          <Route path="/taxes/:id" element={<TaxDetail />} />
          <Route path="/bills" element={<Bills />} />
          <Route path="/bills/new" element={<BillFormPage />} />
          <Route path="/bills/:id/edit" element={<BillFormPage />} />
          <Route path="/bills/:id" element={<BillDetail />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/documents/new" element={<DocumentFormPage />} />
          <Route path="/individual" element={<IndividualList />} />
          <Route path="/individual/new" element={<IndividualDetail />} />
          <Route path="/individual/:id" element={<IndividualDetail />} />
          <Route path="/company" element={<Company />} />
          {/* Admin-only areas: analytics + user management */}
          <Route element={<AdminRoute />}>
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/users" element={<Users />} />
          </Route>
          <Route path="/reports" element={<Reports />} />
          <Route path="/alerts" element={<AlertSettings />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
