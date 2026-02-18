import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function for merging Tailwind CSS classes
 * Uses clsx for conditional classes and tailwind-merge for conflict resolution
 *
 * @example
 * cn('px-4 py-2', 'bg-primary-500', className)
 * cn('px-4', isActive && 'bg-primary-500', disabled && 'opacity-50')
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
