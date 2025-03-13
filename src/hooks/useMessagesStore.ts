
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ProcessingState } from '@/types';
import { format } from 'date-fns';

interface FilterState {
  search: string;
  processingStates: ProcessingState[];
  mediaTypes: string[];
  dateRange: { from: Date; to: Date } | null;
  vendors: string[];
  showGroups: boolean;
  chatSources: string[];
  page: number;
  itemsPerPage: number;
  view: 'grid' | 'list';
  sortField: 'created_at' | 'updated_at' | 'purchase_date';
  sortOrder: 'asc' | 'desc';
}

interface MessagesState {
  filters: FilterState;
  selectedMessage: any | null;
  detailsOpen: boolean;
  analyticsOpen: boolean;
  presetFilters: Record<string, Partial<FilterState>>;
  
  // Actions
  setFilters: (filters: Partial<FilterState>) => void;
  setSelectedMessage: (message: any | null) => void;
  setDetailsOpen: (open: boolean) => void;
  setAnalyticsOpen: (open: boolean) => void;
  setPage: (page: number) => void;
  refreshData: () => Promise<void>;
  
  // Preset actions
  savePreset: (name: string, filters: Partial<FilterState>) => void;
  loadPreset: (name: string) => Partial<FilterState> | null;
  deletePreset: (name: string) => void;
}

// Default date range - last 30 days
const defaultDateFrom = new Date();
defaultDateFrom.setDate(defaultDateFrom.getDate() - 30);

export const useMessagesStore = create<MessagesState>()(
  persist(
    (set, get) => ({
      filters: {
        search: '',
        processingStates: [],
        mediaTypes: [],
        dateRange: null,
        vendors: [],
        showGroups: true,
        chatSources: [],
        page: 1,
        itemsPerPage: 20,
        view: 'grid',
        sortField: 'created_at',
        sortOrder: 'desc',
      },
      selectedMessage: null,
      detailsOpen: false,
      analyticsOpen: false,
      presetFilters: {},
      
      setFilters: (filters) => set((state) => ({
        filters: { ...state.filters, ...filters }
      })),
      
      setSelectedMessage: (message) => set({ selectedMessage: message }),
      
      setDetailsOpen: (open) => set({ detailsOpen: open }),
      
      setAnalyticsOpen: (open) => set({ analyticsOpen: open }),
      
      setPage: (page) => set((state) => ({
        filters: { ...state.filters, page }
      })),
      
      refreshData: async () => {
        // This is a placeholder for any refresh logic that might be needed
        // This would be where we'd put query invalidation or refetch logic
        console.log('Refreshing data...');
        return Promise.resolve();
      },
      
      savePreset: (name, filters) => set((state) => ({
        presetFilters: {
          ...state.presetFilters,
          [name]: filters
        }
      })),
      
      loadPreset: (name) => {
        const preset = get().presetFilters[name];
        return preset || null;
      },
      
      deletePreset: (name) => set((state) => {
        const newPresets = { ...state.presetFilters };
        delete newPresets[name];
        return { presetFilters: newPresets };
      })
    }),
    {
      name: 'enhanced-messages-storage',
      partialize: (state) => ({
        filters: {
          view: state.filters.view,
          itemsPerPage: state.filters.itemsPerPage,
          sortField: state.filters.sortField,
          sortOrder: state.filters.sortOrder
        },
        presetFilters: state.presetFilters,
        detailsOpen: state.detailsOpen
      })
    }
  )
);
