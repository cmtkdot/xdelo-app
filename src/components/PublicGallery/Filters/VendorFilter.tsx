import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { 
  Command, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput, 
  CommandItem, 
  CommandList 
} from "@/components/ui/command";
import { Check, ChevronsUpDown, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface VendorFilterProps {
  value: string[];
  vendors: string[];
  onChange: (value: string[]) => void;
}

export const VendorFilter = ({
  value,
  vendors,
  onChange
}: VendorFilterProps) => {
  const handleSelect = (selectedValue: string) => {
    if (selectedValue === 'all') {
      onChange([]);
    } else if (value.includes(selectedValue)) {
      onChange(value.filter(v => v !== selectedValue));
    } else {
      onChange([...value, selectedValue]);
    }
  };
  
  const clearAll = () => {
    onChange([]);
  };
  
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 border-dashed flex items-center justify-between min-w-[130px]"
        >
          <div className="flex items-center gap-1 truncate">
            <Store className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="truncate">
              {value.length > 0 
                ? value.length > 1 
                  ? `${value.length} vendors` 
                  : value[0]
                : "All vendors"}
            </span>
          </div>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search vendors..." />
          <CommandList>
            <CommandEmpty>No vendor found.</CommandEmpty>
            <CommandGroup>
              <ScrollArea className="h-[200px]">
                <CommandItem
                  value="all"
                  onSelect={() => handleSelect('all')}
                  className="mb-1"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value.length === 0 ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span>All vendors</span>
                </CommandItem>
                
                {vendors.map((vendor) => (
                  <CommandItem
                    key={vendor}
                    value={vendor}
                    onSelect={() => handleSelect(vendor)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value.includes(vendor) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{vendor}</span>
                  </CommandItem>
                ))}
              </ScrollArea>
            </CommandGroup>
          </CommandList>
          
          {value.length > 0 && (
            <div className="p-2 border-t">
              <div className="flex flex-wrap gap-1 mb-2">
                {value.map(vendor => (
                  <Badge 
                    key={vendor} 
                    variant="secondary" 
                    className="text-xs"
                    onClick={() => handleSelect(vendor)}
                  >
                    {vendor}
                    <span className="ml-1 cursor-pointer">×</span>
                  </Badge>
                ))}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full h-7 text-xs"
                onClick={clearAll}
              >
                Clear all
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
};