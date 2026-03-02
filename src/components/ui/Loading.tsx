interface LoadingProps {
  /** Loading message */
  message?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Loading spinner component
 */
function Loading({ message = 'Loading...', size = 'md' }: LoadingProps): React.JSX.Element {
  return (
    <div className="ui-flex-col ui-items-center ui-justify-center ui-gap-sm ui-p-md">
      <div
        className={`ui-spinner ui-spinner-${size}`}
        role="status"
        aria-label="Loading"
      />
      <p className="text-text-muted">{message}</p>
    </div>
  );
}

export default Loading;
