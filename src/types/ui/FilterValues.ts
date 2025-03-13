
import type { ProcessingState } from '../api/ProcessingState';

/**
 * Filter values for UI components
 */
export interface FilterValues {
  search: string;
  vendors: string[];
  sortOrder: "asc" | "desc";
  sortField: "created_at" | "purchase_date";
  showUntitled?: boolean;
  dateRange?: { from: Date; to: Date } | null;
  processingState?: ProcessingState[];
}
