import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function PageHeader({
  title,
  subtitle,
  action,
  backTo,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** Where "back" goes from this page — a sub-screen's way home (PLN-260910). */
  backTo?: { to: string; label: string };
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {backTo && (
          <Link
            to={backTo.to}
            className="mb-2 inline-flex items-center gap-1 rounded-md text-xs font-medium text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            {backTo.label}
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}
