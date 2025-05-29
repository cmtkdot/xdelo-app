
import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'

export interface GalleryFiltersProps {
  filter: string
  setFilter: (filter: string) => void
  viewMode: 'grid' | 'table'
  setViewMode: (mode: 'grid' | 'table') => void
  searchTerm: string
  onSearchChange: (search: string) => void
  vendorFilter: string[]
  vendors: string[]
  onVendorFilterChange: (vendors: string[]) => void
  dateField: string
  onDateFieldChange: (field: string) => void
  sortOrder: string
  onSortOrderChange: (order: string) => void
}

export function GalleryFilters({
  filter,
  setFilter,
  viewMode,
  setViewMode,
  searchTerm,
  onSearchChange,
  vendorFilter,
  vendors,
  onVendorFilterChange,
  dateField,
  onDateFieldChange,
  sortOrder,
  onSortOrderChange
}: GalleryFiltersProps) {
  const handleVendorToggle = (vendor: string) => {
    const updated = vendorFilter.includes(vendor)
      ? vendorFilter.filter(v => v !== vendor)
      : [...vendorFilter, vendor]
    onVendorFilterChange(updated)
  }

  return (
    <div className="space-y-6 p-4 border rounded-lg bg-card">
      <div>
        <Label htmlFor="search" className="text-sm font-medium">
          Search
        </Label>
        <Input
          id="search"
          type="text"
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="mt-1"
        />
      </div>

      <div>
        <Label className="text-sm font-medium">Filter</Label>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Items</SelectItem>
            <SelectItem value="images">Images Only</SelectItem>
            <SelectItem value="videos">Videos Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-sm font-medium">View Mode</Label>
        <div className="flex gap-2 mt-1">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            Grid
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
          >
            Table
          </Button>
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium">Sort By</Label>
        <Select value={dateField} onValueChange={onDateFieldChange}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">Created Date</SelectItem>
            <SelectItem value="purchase_date">Purchase Date</SelectItem>
            <SelectItem value="updated_at">Updated Date</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-sm font-medium">Sort Order</Label>
        <Select value={sortOrder} onValueChange={onSortOrderChange}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Newest First</SelectItem>
            <SelectItem value="asc">Oldest First</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {vendors && vendors.length > 0 && (
        <div>
          <Label className="text-sm font-medium">Vendors</Label>
          <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
            {vendors.map((vendor) => (
              <div key={vendor} className="flex items-center space-x-2">
                <Checkbox
                  id={vendor}
                  checked={vendorFilter.includes(vendor)}
                  onCheckedChange={() => handleVendorToggle(vendor)}
                />
                <Label htmlFor={vendor} className="text-sm">
                  {vendor}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
