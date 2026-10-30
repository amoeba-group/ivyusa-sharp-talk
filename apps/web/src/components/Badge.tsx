import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'gray' | 'primary' | 'success' | 'warning' | 'error' | 'info';

// Tinted fill + hairline ring: readable on white and on the dark surface
// (the tint and the text each have their own dark-mode step).
const tones: Record<Tone, string> = {
  gray: 'bg-gray-100 text-gray-600 ring-gray-500/15',
  primary: 'bg-primary-50 text-primary-700 ring-primary-600/20',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  warning: 'bg-amber-50 text-amber-700 ring-amber-600/25',
  error: 'bg-red-50 text-red-700 ring-red-600/20',
  info: 'bg-sky-50 text-sky-700 ring-sky-600/20',
};

export function Badge({
  tone = 'gray',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
