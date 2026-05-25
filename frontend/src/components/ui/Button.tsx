import { ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

const variants = {
  primary:   'bg-primary-600 text-white hover:bg-primary-700 disabled:bg-primary-400',
  secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:bg-gray-100',
  danger:    'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400',
  ghost:     'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={clsx(
          'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {isLoading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
