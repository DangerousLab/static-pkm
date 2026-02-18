import { type InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Error state */
  hasError?: boolean;
  /** Full width */
  fullWidth?: boolean;
}

/**
 * Reusable input component
 */
const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ hasError = false, fullWidth = true, className = '', ...props }, ref) => {
    const baseStyles =
      'px-3 py-2 rounded-md bg-bg-panel border text-text-main placeholder:text-text-muted transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-accent-gold/50 disabled:opacity-50 disabled:cursor-not-allowed';

    const borderStyles = hasError
      ? 'border-danger focus:border-danger'
      : 'border-border-subtle focus:border-accent-gold';

    const combinedClassName = [
      baseStyles,
      borderStyles,
      fullWidth ? 'w-full' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return <input ref={ref} className={combinedClassName} {...props} />;
  }
);

Input.displayName = 'Input';

export default Input;
