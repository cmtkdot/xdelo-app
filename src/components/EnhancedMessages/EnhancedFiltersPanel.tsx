
import React, { useState, useEffect } from 'react';
import { Separator } from '@/components/ui/separator';
import { DateRange } from 'react-day-picker';
import { ProcessingState } from '@/types';
import { useVendors } from '@/hooks/useVendors';
import { useMessagesStore } from '@/hooks/useMessagesStore';

// Import filter components
import { SearchFilter } from './Filters/SearchFilter';
import { ProcessingStateFilter } from './Filters/ProcessingStateFilter';
import { MediaTypeFilter } from './Filters/MediaTypeFilter';
import { VendorFilter } from './Filters/VendorFilter';
import { DateRangeFilter } from './Filters/DateRangeFilter';
import { ShowGroupsFilter } from './Filters/ShowGroupsFilter';
import { FilterPresets } from './Filters/FilterPresets';
import { FilterImportExport } from './Filters/FilterImportExport';
import { FilterHeader } from './Filters/FilterHeader';

export const EnhancedFiltersPanel: React.FC = () => {
  const { data: vendors = [] } = useVendors();
  const { filters, setFilters, setPage, presetFilters, savePreset, loadPreset } = useMessagesStore();
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState(filters.search);
  const [processingStates, setProcessingStates] = useState<ProcessingState[]>(filters.processingStates);
  const [selectedVendors, setSelectedVendors] = useState<string[]>(filters.vendors);
  const [mediaTypes, setMediaTypes] = useState<string[]>(filters.mediaTypes);
  const [showGroups, setShowGroups] = useState(filters.showGroups);
  const [date, setDate] = useState<DateRange | undefined>(
    filters.dateRange 
      ? { from: filters.dateRange.from, to: filters.dateRange.to } 
      : undefined
  );
  const [presetName, setPresetName] = useState('');
  
  // Apply filters to the store
  const applyFilters = () => {
    setFilters({
      ...filters,
      search: searchTerm,
      processingStates,
      vendors: selectedVendors,
      mediaTypes,
      showGroups,
      dateRange: date && date.from && date.to 
        ? { from: date.from, to: date.to } 
        : null,
    });
    setPage(1);
  };
  
  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setProcessingStates([]);
    setSelectedVendors([]);
    setMediaTypes([]);
    setShowGroups(true);
    setDate(undefined);
    
    setFilters({
      ...filters,
      search: '',
      processingStates: [],
      vendors: [],
      mediaTypes: [],
      showGroups: true,
      dateRange: null,
    });
    setPage(1);
  };

  // Handle save preset
  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    
    savePreset(presetName, {
      search: searchTerm,
      processingStates,
      vendors: selectedVendors,
      mediaTypes,
      showGroups,
      dateRange: date && date.from && date.to 
        ? { from: date.from, to: date.to } 
        : null,
    });
    
    setPresetName('');
  };
  
  // Handle load preset
  const handleLoadPreset = (name: string) => {
    const preset = loadPreset(name);
    if (!preset) return;
    
    setSearchTerm(preset.search || '');
    setProcessingStates(preset.processingStates || []);
    setSelectedVendors(preset.vendors || []);
    setMediaTypes(preset.mediaTypes || []);
    setShowGroups(preset.showGroups ?? true);
    setDate(preset.dateRange 
      ? { from: preset.dateRange.from, to: preset.dateRange.to } 
      : undefined);
    
    setFilters({
      ...filters,
      ...preset
    });
    setPage(1);
  };

  // Export filters
  const exportFilters = () => {
    const filtersData = JSON.stringify(filters, null, 2);
    const blob = new Blob([filtersData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'message-filters.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import filters
  const importFilters = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const importedFilters = JSON.parse(event.target?.result as string);
          setFilters(importedFilters);
          setSearchTerm(importedFilters.search || '');
          setProcessingStates(importedFilters.processingStates || []);
          setSelectedVendors(importedFilters.vendors || []);
          setMediaTypes(importedFilters.mediaTypes || []);
          setShowGroups(importedFilters.showGroups ?? true);
          setDate(importedFilters.dateRange);
          setPage(1);
        } catch (error) {
          console.error('Failed to parse imported filters:', error);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // Update local state when filters change
  useEffect(() => {
    setSearchTerm(filters.search);
    setProcessingStates(filters.processingStates);
    setSelectedVendors(filters.vendors);
    setMediaTypes(filters.mediaTypes);
    setShowGroups(filters.showGroups);
    setDate(filters.dateRange 
      ? { from: filters.dateRange.from, to: filters.dateRange.to } 
      : undefined);
  }, [filters]);
  
  // Auto-apply filters when certain options change
  useEffect(() => {
    applyFilters();
  }, [processingStates, mediaTypes, showGroups]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="py-2 h-full flex flex-col">
      <FilterHeader 
        clearFilters={clearFilters}
        applyFilters={applyFilters}
      />

      <div className="space-y-4 flex-1 overflow-y-auto pr-1">
        {/* Search Filter */}
        <SearchFilter 
          searchTerm={searchTerm} 
          setSearchTerm={setSearchTerm} 
          applyFilters={applyFilters} 
        />

        {/* Processing State Filter */}
        <ProcessingStateFilter 
          processingStates={processingStates}
          setProcessingStates={setProcessingStates}
        />

        {/* Media Type Filter */}
        <MediaTypeFilter 
          mediaTypes={mediaTypes}
          setMediaTypes={setMediaTypes}
        />

        {/* Vendors Filter */}
        <VendorFilter 
          vendors={vendors}
          selectedVendors={selectedVendors}
          setSelectedVendors={setSelectedVendors}
          applyFilters={applyFilters}
        />

        {/* Date Range Filter */}
        <DateRangeFilter 
          date={date}
          setDate={setDate}
          applyFilters={applyFilters}
        />

        {/* Show Groups Toggle */}
        <ShowGroupsFilter 
          showGroups={showGroups}
          setShowGroups={setShowGroups}
        />

        <Separator className="my-4" />

        {/* Presets */}
        <FilterPresets 
          presetName={presetName}
          setPresetName={setPresetName}
          presetFilters={presetFilters}
          handleSavePreset={handleSavePreset}
          handleLoadPreset={handleLoadPreset}
          exportFilters={exportFilters}
          importFilters={importFilters}
        />
        
        {/* Import/Export */}
        <FilterImportExport 
          exportFilters={exportFilters}
          importFilters={importFilters}
        />
      </div>
    </div>
  );
};
