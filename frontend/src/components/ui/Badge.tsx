import React from 'react';

type BadgeVariant =
  | 'critical'
  | 'danger'
  | 'warning'
  | 'success'
  | 'info'
  | 'neutral'
  | 'purple'
  | 'cold';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
  dot = false,
}) => {
  const variantStyles: Record<BadgeVariant, string> = {
    critical: 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-500/20',
    danger: 'bg-red-50 text-red-700 border-red-200 ring-red-500/20',
    warning: 'bg-amber-50 text-amber-800 border-amber-200 ring-amber-500/20',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-500/20',
    info: 'bg-blue-50 text-blue-700 border-blue-200 ring-blue-500/20',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200 ring-slate-500/20',
    purple: 'bg-indigo-50 text-indigo-700 border-indigo-200 ring-indigo-500/20',
    cold: 'bg-cyan-50 text-cyan-800 border-cyan-200 ring-cyan-500/20',
  };

  const dotColors: Record<BadgeVariant, string> = {
    critical: 'bg-rose-500',
    danger: 'bg-red-500',
    warning: 'bg-amber-500',
    success: 'bg-emerald-500',
    info: 'bg-blue-500',
    neutral: 'bg-slate-400',
    purple: 'bg-indigo-500',
    cold: 'bg-cyan-500',
  };

  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-1 font-semibold',
    lg: 'text-sm px-3 py-1.5 font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border shadow-2xs transition-colors ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
};

export const StatusBadge: React.FC<{ status: string; size?: 'sm' | 'md' }> = ({ status, size = 'md' }) => {
  const s = status.toLowerCase();

  if (s === 'critical' || s === 'failed' || s === 'cancelled' || s === 'delayed') {
    return (
      <Badge variant="critical" size={size} dot>
        {status.replace(/_/g, ' ').toUpperCase()}
      </Badge>
    );
  }
  if (s === 'quarantine' || s === 'urgent' || s === 'pending' || s === 'draft') {
    return (
      <Badge variant="warning" size={size} dot>
        {status.replace(/_/g, ' ').toUpperCase()}
      </Badge>
    );
  }
  if (s === 'passed' || s === 'delivered' || s === 'approved' || s === 'completed' || s === 'received') {
    return (
      <Badge variant="success" size={size} dot>
        {status.replace(/_/g, ' ').toUpperCase()}
      </Badge>
    );
  }
  if (s === 'in_transit' || s === 'dispatched' || s === 'shipped' || s === 'allocated') {
    return (
      <Badge variant="info" size={size} dot>
        {status.replace(/_/g, ' ').toUpperCase()}
      </Badge>
    );
  }
  return (
    <Badge variant="neutral" size={size}>
      {status.replace(/_/g, ' ').toUpperCase()}
    </Badge>
  );
};
