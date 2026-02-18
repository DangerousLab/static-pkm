interface LoadingProps {
  /** Loading message */
  message?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/** Size styles */
const sizeStyles = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

const spinnerSizeStyles = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

/**
 * Loading spinner component
 */
function Loading({ message = 'Loading...', size = 'md' }: LoadingProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-4">
      <div
        className={`${spinnerSizeStyles[size]} border-2 border-border-subtle border-t-accent-gold rounded-full animate-spin`}
        role="status"
        aria-label="Loading"
      />
      <p className={`text-text-muted ${sizeStyles[size]}`}>{message}</p>
    </div>
  );
}

export default Loading;
