import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none rounded-md';

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1.5 h-8',
    md: 'text-sm px-4 py-2 h-9',
    lg: 'text-base px-6 py-2.5 h-11',
  }[size];

  const variantClasses = {
    primary: 'bg-black text-white hover:bg-neutral-800 border border-black',
    secondary: 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200 border border-neutral-300',
    outline: 'bg-transparent text-neutral-900 border border-neutral-300 hover:bg-neutral-50',
    danger: 'bg-neutral-900 text-white hover:bg-black border border-neutral-900',
    ghost: 'bg-transparent text-neutral-700 hover:bg-neutral-100',
  }[variant];

  return (
    <button
      disabled={disabled || loading}
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
          <span>Loading...</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
};

