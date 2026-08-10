import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Send,
  Users,
  Settings,
  Mail,
  FileText,
  Megaphone,
  Shield,
  X,
} from 'lucide-react';

interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Dashboard',
    items: [
      { label: 'Overview', to: '/dashboard', icon: LayoutDashboard },
      { label: 'Activity Log', to: '/dashboard/activity', icon: Activity },
      { label: 'Failure Report', to: '/dashboard/failures', icon: AlertTriangle },
    ],
  },
  {
    title: 'Campaign Builder',
    items: [
      { label: 'Broadcasts', to: '/campaigns/broadcasts', icon: Megaphone },
      { label: 'Transactional Logs', to: '/campaigns/transactional', icon: FileText },
      { label: 'Templates', to: '/campaigns/templates', icon: Mail },
    ],
  },
  {
    title: 'Audience',
    items: [
      { label: 'User Segments', to: '/audience/segments', icon: Users },
      { label: 'Suppression List', to: '/audience/suppression', icon: Shield },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { label: 'Provider Settings', to: '/config/providers', icon: Settings },
      { label: 'Domain Auth', to: '/config/domains', icon: Globe },
      { label: 'Test Environment', to: '/config/test', icon: FlaskConical },
    ],
  },
  {
    title: 'Sent',
    items: [
      { label: 'Sent History', to: '/sent', icon: Send },
    ],
  },
];

import { Activity, AlertTriangle, Globe, FlaskConical } from 'lucide-react';

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const location = useLocation();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-neutral-900/50 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-neutral-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-neutral-200 px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
              <Mail className="h-5 w-5 text-white" />
            </div>
            <span className="text-base font-semibold text-neutral-900">MailForge</span>
          </div>
          <button onClick={onClose} className="lg:hidden text-neutral-500 hover:text-neutral-900">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex h-[calc(100vh-4rem)] flex-col gap-6 overflow-y-auto px-3 py-4">
          {navSections.map((section) => (
            <div key={section.title}>
              <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                {section.title}
              </p>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.to;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onClose}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
