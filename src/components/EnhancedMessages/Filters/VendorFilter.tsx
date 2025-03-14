
import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

interface VendorFilterProps {
  vendors: string[];
  selectedVendors: string[];
  setSelectedVendors: (vendors: string[]) => void;
  applyFilters: () => void;
}

export function VendorFilter({ 
  vendors = [], 
  selectedVendors = [], 
  setSelectedVendors,
  applyFilters
}: VendorFilterProps) {
  const [vendorPopoverOpen, setVendorPopoverOpen] = useState(false);
  
  // Ensure arrays are valid
  const safeVendors = Array.isArray(vendors) ? vendors : [];
  const safeSelectedVendors = Array.isArray(selectedVendors) ? selectedVendors : [];
  
  return (
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
            {safeSelectedVendors.length === 0
              ? "Select vendors..."
              : `${safeSelectedVendors.length} vendor${safeSelectedVendors.length !== 1 ? 's' : ''} selected`}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0">
          <Command>
            <CommandInput placeholder="Search vendors..." />
            <CommandList>
              <CommandEmpty>No vendors found.</CommandEmpty>
              <CommandGroup>
                {safeVendors.map((vendor) => (
                  <CommandItem
                    key={vendor}
                    value={vendor}
                    onSelect={() => {
                      setSelectedVendors(
                        safeSelectedVendors.includes(vendor)
                          ? safeSelectedVendors.filter((v) => v !== vendor)
                          : [...safeSelectedVendors, vendor]
                      );
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        safeSelectedVendors.includes(vendor)
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
      
      {safeSelectedVendors.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {safeSelectedVendors.map((vendor) => (
            <Badge key={vendor} variant="secondary" className="gap-1">
              {vendor}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => {
                  setSelectedVendors(safeSelectedVendors.filter((v) => v !== vendor));
                }}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
