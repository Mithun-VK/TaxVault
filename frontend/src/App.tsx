import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/shared/ProtectedRoute';
import { RequirePermission } from '@/components/shared/RequirePermission';
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
import { Approvals } from '@/pages/Approvals';
import { Reports } from '@/pages/Reports';
import { Users } from '@/pages/Users';
import { IndividualList } from '@/pages/IndividualList';
import { IndividualDetail } from '@/pages/IndividualDetail';
import { CompanyList } from '@/pages/CompanyList';
import { CompanyDetail } from '@/pages/CompanyDetail';
import { AlertSettings } from '@/pages/AlertSettings';
import { Profile } from '@/pages/Profile';

/**
 * Route table, gated by the RBAC matrix in utils/permissions.ts. Read pages sit
 * behind the matching `*.view`; the create and edit form pages behind
 * `*.create` / `*.edit`, so an admin (who may add but not change) can open
 * "/bills/new" but not "/bills/:id/edit". Home and Profile are open to
 * everyone. Anything a role cannot open redirects to the home hub.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Shell />}>
          <Route path="/" element={<Home />} />
          <Route path="/profile" element={<Profile />} />

          <Route element={<RequirePermission permission="calendar.view" />}>
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>

          {/* Properties */}
          <Route element={<RequirePermission permission="properties.create" />}>
            <Route path="/assets/new" element={<AssetFormPage />} />
          </Route>
          <Route element={<RequirePermission permission="properties.edit" />}>
            <Route path="/assets/:id/edit" element={<AssetFormPage />} />
          </Route>
          <Route element={<RequirePermission permission="properties.view" />}>
            <Route path="/assets" element={<Properties />} />
            <Route path="/assets/:id" element={<AssetDetail />} />
          </Route>

          {/* Insurance */}
          <Route element={<RequirePermission permission="insurance.create" />}>
            <Route path="/insurance/new" element={<InsuranceFormPage />} />
          </Route>
          <Route
            element={
              <RequirePermission permission={['insurance.edit', 'insurance.request_change']} />
            }
          >
            <Route path="/insurance/:id/edit" element={<InsuranceFormPage />} />
          </Route>
          <Route element={<RequirePermission permission="insurance.view" />}>
            <Route path="/insurance" element={<Insurance />} />
            <Route path="/insurance/:id" element={<InsuranceDetail />} />
          </Route>

          {/* Taxes */}
          <Route element={<RequirePermission permission="taxes.create" />}>
            <Route path="/taxes/new" element={<TaxFormPage />} />
          </Route>
          <Route element={<RequirePermission permission={['taxes.edit', 'taxes.request_change']} />}>
            <Route path="/taxes/:id/edit" element={<TaxFormPage />} />
          </Route>
          <Route element={<RequirePermission permission="taxes.view" />}>
            <Route path="/taxes" element={<Taxes />} />
            <Route path="/taxes/:id" element={<TaxDetail />} />
          </Route>

          {/* Bills. Members hold `request_change` rather than `edit`, so the
              edit page opens for them too — submitting files it for approval. */}
          <Route element={<RequirePermission permission="bills.create" />}>
            <Route path="/bills/new" element={<BillFormPage />} />
          </Route>
          <Route element={<RequirePermission permission={['bills.edit', 'bills.request_change']} />}>
            <Route path="/bills/:id/edit" element={<BillFormPage />} />
          </Route>
          <Route element={<RequirePermission permission="bills.view" />}>
            <Route path="/bills" element={<Bills />} />
            <Route path="/bills/:id" element={<BillDetail />} />
          </Route>

          <Route element={<RequirePermission permission="payments.view" />}>
            <Route path="/payments" element={<Payments />} />
          </Route>

          {/* Document library — members can attach receipts but not browse it */}
          <Route element={<RequirePermission permission="documents.create" />}>
            <Route path="/documents/new" element={<DocumentFormPage />} />
          </Route>
          <Route element={<RequirePermission permission="documents.browse" />}>
            <Route path="/documents" element={<Documents />} />
          </Route>

          <Route element={<RequirePermission permission="individuals.create" />}>
            <Route path="/individual/new" element={<IndividualDetail />} />
          </Route>
          <Route element={<RequirePermission permission="individuals.view" />}>
            <Route path="/individual" element={<IndividualList />} />
            <Route path="/individual/:id" element={<IndividualDetail />} />
          </Route>

          <Route element={<RequirePermission permission="company.create" />}>
            <Route path="/company/new" element={<CompanyDetail />} />
          </Route>
          <Route element={<RequirePermission permission="company.view" />}>
            <Route path="/company" element={<CompanyList />} />
            <Route path="/company/:id" element={<CompanyDetail />} />
          </Route>
          <Route element={<RequirePermission permission="analytics.view" />}>
            <Route path="/analytics" element={<Analytics />} />
          </Route>
          <Route element={<RequirePermission permission="reports.view" />}>
            <Route path="/reports" element={<Reports />} />
          </Route>
          <Route element={<RequirePermission permission="alerts.view" />}>
            <Route path="/alerts" element={<AlertSettings />} />
          </Route>
          {/* Reviewer-only: the queue is where admins sign off members' changes. */}
          <Route element={<RequirePermission permission="change_requests.review" />}>
            <Route path="/approvals" element={<Approvals />} />
          </Route>
          <Route element={<RequirePermission permission="users.manage" />}>
            <Route path="/users" element={<Users />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
