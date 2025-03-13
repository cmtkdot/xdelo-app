
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { 
  Select, 
  SelectContent, 
  SelectGroup, 
  SelectItem, 
  SelectLabel, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { 
  Check, 
  ChevronsUpDown, 
  CalendarIcon, 
  X, 
  Plus,
  Filter, 
  Save,
  FileDown,
  FileUp
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ProcessingState } from '@/types';
import { Badge } from '@/components/ui/badge';
import { useVendors } from '@/hooks/useVendors';
import { useMessagesStore } from '@/hooks/useMessagesStore';

export const EnhancedFiltersPanel: React.FC = () => {
  const { data: vendors = [] } = useVendors();
  const { filters, setFilters, setPage, presetFilters, savePreset, loadPreset } = useMessagesStore();
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState(filters.search);
  const [processingStates, setProcessingStates] = useState<ProcessingState[]>(filters.processingStates);
  const [selectedVendors, setSelectedVendors] = useState<string[]>(filters.vendors);
  const [mediaTypes, setMediaTypes] = useState<string[]>(filters.mediaTypes);
  const [showGroups, setShowGroups] = useState(filters.showGroups);
  const [date, setDate] = useState<{ from: Date; to: Date } | null>(filters.dateRange);
  const [vendorPopoverOpen, setVendorPopoverOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  
  // Selection options
  const processingStateOptions: ProcessingState[] = [
    'completed', 'processing', 'error', 'pending', 'initialized'
  ];
  
  const mediaTypeOptions = [
    { value: 'image', label: 'Images' },
    { value: 'video', label: 'Videos' },
    { value: 'application', label: 'Documents' },
    { value: 'audio', label: 'Audio' }
  ];
  
  // Apply filters to the store
  const applyFilters = () => {
    setFilters({
      ...filters,
      search: searchTerm,
      processingStates,
      vendors: selectedVendors,
      mediaTypes,
      showGroups,
      dateRange: date,
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
    setDate(null);
    
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
      dateRange: date,
    });
    
    setPresetName('');
  };
  
  // Handle load preset
  const handleLoadPreset = (name: string) => {
    const preset = loadPreset(name);
    if (!preset) return;
    
    setSearchTerm(preset.search);
    setProcessingStates(preset.processingStates);
    setSelectedVendors(preset.vendors);
    setMediaTypes(preset.mediaTypes);
    setShowGroups(preset.showGroups);
    setDate(preset.dateRange);
    
    setFilters({
      ...filters,
      ...preset
    });
    setPage(1);
  };

  // Update local state when filters change
  useEffect(() => {
    setSearchTerm(filters.search);
    setProcessingStates(filters.processingStates);
    setSelectedVendors(filters.vendors);
    setMediaTypes(filters.mediaTypes);
    setShowGroups(filters.showGroups);
    setDate(filters.dateRange);
  }, [filters]);
  
  // Auto-apply filters when certain options change
  useEffect(() => {
    applyFilters();
  }, [processingStates, mediaTypes, showGroups]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="py-2 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium flex items-center">
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </h3>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={clearFilters}
          className="h-8 px-2 text-xs gap-1"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto pr-1">
        {/* Search */}
        <div className="space-y-2">
          <Label htmlFor="search">Search</Label>
          <div className="flex gap-2">
            <Input
              id="search"
              placeholder="Search messages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Button 
              variant="outline" 
              onClick={applyFilters}
              className="shrink-0"
            >
              Search
            </Button>
          </div>
        </div>

        {/* Processing State */}
        <div className="space-y-2">
          <Label>Processing State</Label>
          <div className="flex flex-wrap gap-2">
            {processingStateOptions.map((state) => (
              <Badge
                key={state}
                variant={processingStates.includes(state) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => {
                  setProcessingStates(
                    processingStates.includes(state)
                      ? processingStates.filter((s) => s !== state)
                      : [...processingStates, state]
                  );
                }}
              >
                {state}
                {processingStates.includes(state) && (
                  <X className="ml-1 h-3 w-3" />
                )}
              </Badge>
            ))}
          </div>
        </div>

        {/* Media Type */}
        <div className="space-y-2">
          <Label>Media Type</Label>
          <div className="flex flex-wrap gap-2">
            {mediaTypeOptions.map((type) => (
              <Badge
                key={type.value}
                variant={mediaTypes.includes(type.value) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => {
                  setMediaTypes(
                    mediaTypes.includes(type.value)
                      ? mediaTypes.filter((t) => t !== type.value)
                      : [...mediaTypes, type.value]
                  );
                }}
              >
                {type.label}
                {mediaTypes.includes(type.value) && (
                  <X className="ml-1 h-3 w-3" />
                )}
              </Badge>
            ))}
          </div>
        </div>

        {/* Vendors */}
        <div className="space-y-2">
          <Label>Vendors</Label>
          <Popover open={vendorPopoverOpen} onOpenChange={setVendorPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={vendorPopoverOpen}
                className="w-full justify-between"
              >
                {selectedVendors.length === 0
                  ? "Select vendors..."
                  : `${selectedVendors.length} vendor${selectedVendors.length !== 1 ? 's' : ''} selected`}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
              <Command>
                <CommandInput placeholder="Search vendors..." />
                <CommandList>
                  <CommandEmpty>No vendors found.</CommandEmpty>
                  <CommandGroup>
                    {vendors.map((vendor) => (
                      <CommandItem
                        key={vendor}
                        value={vendor}
                        onSelect={() => {
                          setSelectedVendors(
                            selectedVendors.includes(vendor)
                              ? selectedVendors.filter((v) => v !== vendor)
                              : [...selectedVendors, vendor]
                          );
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedVendors.includes(vendor)
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        {vendor}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
                <div className="border-t p-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full" 
                    onClick={() => {
                      applyFilters();
                      setVendorPopoverOpen(false);
                    }}
                  >
                    Apply
                  </Button>
                </div>
              </Command>
            </PopoverContent>
          </Popover>
          
          {selectedVendors.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {selectedVendors.map((vendor) => (
                <Badge key={vendor} variant="secondary" className="gap-1">
                  {vendor}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => {
                      setSelectedVendors(selectedVendors.filter((v) => v !== vendor));
                    }}
                  />
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Date Range */}
        <div className="space-y-2">
          <Label>Date Range</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "LLL dd, y")} -{" "}
                      {format(date.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(date.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="range"
                selected={date || undefined}
                onSelect={setDate}
                initialFocus
              />
              <div className="p-2 border-t border-border">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full" 
                  onClick={applyFilters}
                >
                  Apply Date Range
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          
          {date && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-1 h-7 px-2 text-xs" 
              onClick={() => {
                setDate(null);
                applyFilters();
              }}
            >
              <X className="mr-1 h-3 w-3" />
              Clear dates
            </Button>
          )}
        </div>

        {/* Show Groups Toggle */}
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="show-groups" 
            checked={showGroups} 
            onCheckedChange={(checked) => setShowGroups(Boolean(checked))} 
          />
          <Label htmlFor="show-groups">Show Media Groups</Label>
        </div>

        <Separator className="my-4" />

        {/* Presets */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Filter Presets</h4>
          
          <div className="flex gap-2">
            <Input
              placeholder="Preset name"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              className="flex-1"
            />
            <Button 
              variant="outline" 
              onClick={handleSavePreset} 
              disabled={!presetName.trim()}
              size="icon"
            >
              <Save className="h-4 w-4" />
            </Button>
          </div>
          
          {Object.keys(presetFilters).length > 0 && (
            <div className="space-y-2">
              <Label>Saved Presets</Label>
              <Select onValueChange={handleLoadPreset}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a preset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Presets</SelectLabel>
                    {Object.keys(presetFilters).map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 gap-1"
              onClick={() => {
                // This would trigger a file download with the current filters
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
              }}
            >
              <FileDown className="h-4 w-4" />
              Export
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 gap-1"
              onClick={() => {
                // This would trigger a file upload for importing filters
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
              }}
            >
              <FileUp className="h-4 w-4" />
              Import
            </Button>
          </div>
        </div>
      </div>
      
      <div className="pt-4 border-t mt-4">
        <Button className="w-full" onClick={applyFilters}>
          Apply Filters
        </Button>
      </div>
    </div>
  );
};
