import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Loading } from '@/components/States';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading, isAdmin } = useAuth();

  if (loading) {
    return <Loading message="Restoring session..." />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="mt-4 text-lg font-semibold text-neutral-900">Access Denied</h1>
        <p className="mt-1 text-sm text-neutral-500 max-w-sm">
          Your account does not have admin privileges. Contact your administrator.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
