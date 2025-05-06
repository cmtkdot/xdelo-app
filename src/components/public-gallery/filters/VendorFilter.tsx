import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown, Store } from "lucide-react";
import { useState } from "react";

interface VendorFilterProps {
  value: string[];
  vendors: string[];
  onChange: (value: string[]) => void;
}

export const VendorFilter = ({
  value,
  vendors,
  onChange,
}: VendorFilterProps) => {
  const [open, setOpen] = useState(false);

  const handleToggleVendor = (vendor: string) => {
    const newValue = value.includes(vendor)
      ? value.filter((v) => v !== vendor)
      : [...value, vendor];
    onChange(newValue);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          size="sm"
          className="h-8 gap-1 transition-all duration-200 ease-in-out"
        >
          <Store className="h-3.5 w-3.5" />
          <span className="truncate max-w-[100px]">
            {value.length > 0
              ? value.length === 1
                ? value[0]
                : `${value.length} vendors`
              : "All Vendors"}
          </span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Command>
          <CommandInput placeholder="Search vendor..." />
          <CommandEmpty>No vendor found.</CommandEmpty>
          <CommandGroup className="max-h-60 overflow-auto">
            {vendors.map((vendor) => (
              <CommandItem
                key={vendor}
                value={vendor}
                onSelect={() => handleToggleVendor(vendor)}
              >
                <Check
                  className={`mr-2 h-4 w-4 ${
                    value.includes(vendor) ? "opacity-100" : "opacity-0"
                  }`}
                />
                {vendor}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
