import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardOverview } from '@/pages/DashboardOverview';
import { ActivityLog } from '@/pages/ActivityLog';
import { FailureReport } from '@/pages/FailureReport';
import { Broadcasts } from '@/pages/Broadcasts';
import { BroadcastComposer } from '@/pages/BroadcastComposer';
import { TransactionalLogs } from '@/pages/TransactionalLogs';
import { Templates } from '@/pages/Templates';
import { UserSegments } from '@/pages/UserSegments';
import { SuppressionList } from '@/pages/SuppressionList';
import { ProviderSettings } from '@/pages/ProviderSettings';
import { DomainAuth } from '@/pages/DomainAuth';
import { TestEnvironment } from '@/pages/TestEnvironment';
import { SentHistory } from '@/pages/SentHistory';
import { CampaignDetail } from '@/pages/CampaignDetail';

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardOverview />} />
              <Route path="dashboard/activity" element={<ActivityLog />} />
              <Route path="dashboard/failures" element={<FailureReport />} />
              <Route path="campaigns/broadcasts" element={<Broadcasts />} />
              <Route path="campaigns/broadcasts/:id" element={<BroadcastComposer />} />
              <Route path="campaigns/broadcasts/new" element={<BroadcastComposer />} />
              <Route path="campaigns/transactional" element={<TransactionalLogs />} />
              <Route path="campaigns/templates" element={<Templates />} />
              <Route path="audience/segments" element={<UserSegments />} />
              <Route path="audience/suppression" element={<SuppressionList />} />
              <Route path="config/providers" element={<ProviderSettings />} />
              <Route path="config/domains" element={<DomainAuth />} />
              <Route path="config/test" element={<TestEnvironment />} />
              <Route path="sent" element={<SentHistory />} />
              <Route path="sent/:id" element={<CampaignDetail />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
