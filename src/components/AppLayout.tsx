import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard Overview',
  '/dashboard/activity': 'Activity Log',
  '/dashboard/failures': 'Failure Report',
  '/campaigns/broadcasts': 'Broadcasts',
  '/campaigns/transactional': 'Transactional Logs',
  '/campaigns/templates': 'Email Templates',
  '/audience/segments': 'User Segments',
  '/audience/suppression': 'Suppression List',
  '/config/providers': 'Provider Settings',
  '/config/domains': 'Domain Authentication',
  '/config/test': 'Test Environment',
  '/sent': 'Sent History',
};

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const getTitle = () => {
    for (const [path, title] of Object.entries(pageTitles)) {
      if (location.pathname === path || location.pathname.startsWith(path + '/')) {
        return title;
      }
    }
    return 'Dashboard';
  };

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title={getTitle()} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
