// Central utilities exports
export * from './generalUtils';
export * from './productMatching';
export * from './syncUtils';

// Common formatters
export function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}
