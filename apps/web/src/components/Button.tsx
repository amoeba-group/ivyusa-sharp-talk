import type { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and blocks repeat clicks while a request is in flight. */
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'bg-primary-600 text-white shadow-sm hover:bg-primary-700 disabled:hover:bg-primary-600',
  secondary:
    'border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50 hover:text-gray-900 disabled:hover:bg-white',
  ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:hover:bg-transparent',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:hover:bg-red-600',
};

const sizes: Record<Size, string> = {
  sm: 'min-h-[32px] px-3 py-1.5 text-[13px]',
  md: 'min-h-[36px] px-4 py-2 text-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium leading-5 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        'disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
