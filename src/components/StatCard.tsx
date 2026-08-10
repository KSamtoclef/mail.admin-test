import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: { value: string; positive: boolean };
  accent?: 'blue' | 'green' | 'amber' | 'red' | 'neutral';
}

const accentStyles = {
  blue: 'bg-primary-50 text-primary-600',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  neutral: 'bg-neutral-100 text-neutral-600',
};

export function StatCard({ label, value, icon, trend, accent = 'neutral' }: StatCardProps) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-neutral-500">{label}</p>
        {icon && (
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${accentStyles[accent]}`}>
            {icon}
          </div>
        )}
      </div>
      <p className="mt-3 text-2xl font-semibold text-neutral-900">{value}</p>
      {trend && (
        <p className={`mt-1 text-xs font-medium ${trend.positive ? 'text-emerald-600' : 'text-red-600'}`}>
          {trend.value}
        </p>
      )}
    </div>
  );
}
