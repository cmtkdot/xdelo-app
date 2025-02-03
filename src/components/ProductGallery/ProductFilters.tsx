import { FilterValues } from "@/types";
import { useEffect } from "react";

interface ProductFiltersProps {
  vendors: string[];
  filters: FilterValues;
  onFilterChange: (filters: FilterValues) => void;
}

export const ProductFilters = ({ vendors, filters, onFilterChange }: ProductFiltersProps) => {
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, search: event.target.value });
  };

  const handleVendorChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...filters, vendor: event.target.value });
  };

  const handleDateFromChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, dateFrom: event.target.value ? new Date(event.target.value) : undefined });
  };

  const handleDateToChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, dateTo: event.target.value ? new Date(event.target.value) : undefined });
  };

  const handleSortOrderChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...filters, sortOrder: event.target.value as "asc" | "desc" });
  };

  useEffect(() => {
    // Reset filters when vendors change
    onFilterChange({ ...filters, vendor: "all" });
  }, [vendors]);

  return (
    <div className="flex flex-col md:flex-row gap-4">
      <input
        type="text"
        placeholder="Search..."
        value={filters.search}
        onChange={handleSearchChange}
        className="border rounded p-2"
      />
      <select value={filters.vendor} onChange={handleVendorChange} className="border rounded p-2">
        <option value="all">All Vendors</option>
        {vendors.map(vendor => (
          <option key={vendor} value={vendor}>{vendor}</option>
        ))}
      </select>
      <input
        type="date"
        value={filters.dateFrom ? filters.dateFrom.toISOString().split('T')[0] : ''}
        onChange={handleDateFromChange}
        className="border rounded p-2"
      />
      <input
        type="date"
        value={filters.dateTo ? filters.dateTo.toISOString().split('T')[0] : ''}
        onChange={handleDateToChange}
        className="border rounded p-2"
      />
      <select value={filters.sortOrder} onChange={handleSortOrderChange} className="border rounded p-2">
        <option value="desc">Sort by Date (Newest First)</option>
        <option value="asc">Sort by Date (Oldest First)</option>
      </select>
    </div>
  );
};
