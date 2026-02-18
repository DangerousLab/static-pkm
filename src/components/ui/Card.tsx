import { type HTMLAttributes, forwardRef } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Card variant */
  variant?: 'default' | 'elevated' | 'outlined';
  /** Padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

/** Variant styles */
const variantStyles = {
  default: 'bg-bg-card',
  elevated: 'bg-gradient-card shadow-lg',
  outlined: 'bg-transparent border border-border-subtle',
};

/** Padding styles */
const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

/**
 * Reusable card component
 */
const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    { variant = 'default', padding = 'md', className = '', children, ...props },
    ref
  ) => {
    const baseStyles = 'rounded-lg';

    const combinedClassName = [
      baseStyles,
      variantStyles[variant],
      paddingStyles[padding],
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div ref={ref} className={combinedClassName} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export default Card;
