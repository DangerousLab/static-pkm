import { type ButtonHTMLAttributes, forwardRef } from 'react';

/** Button variant types */
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/** Button size types */
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant */
  variant?: ButtonVariant;
  /** Size variant */
  size?: ButtonSize;
  /** Full width */
  fullWidth?: boolean;
  /** Loading state */
  isLoading?: boolean;
}

/** Variant styles */
const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-accent-gold text-bg hover:bg-accent-gold/90 active:bg-accent-gold/80',
  secondary:
    'bg-bg-panel text-text-main border border-border-subtle hover:bg-bg-hover active:bg-bg-panel',
  ghost:
    'bg-transparent text-text-main hover:bg-bg-hover active:bg-bg-panel',
  danger:
    'bg-danger text-white hover:bg-danger/90 active:bg-danger/80',
};

/** Size styles */
const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-2 py-1 text-sm rounded',
  md: 'px-4 py-2 text-base rounded-md',
  lg: 'px-6 py-3 text-lg rounded-lg',
};

/**
 * Reusable button component
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      isLoading = false,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-accent-gold/50 disabled:opacity-50 disabled:cursor-not-allowed';

    const combinedClassName = [
      baseStyles,
      variantStyles[variant],
      sizeStyles[size],
      fullWidth ? 'w-full' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        className={combinedClassName}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <span className="mr-2 animate-spin">⟳</span>
            Loading...
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
