import { useState } from "react";
import { MediaItem, FilterValues } from "@/types";
import { MediaEditDialog } from "@/components/MediaEditDialog";
import { useToast } from "@/components/ui/use-toast";
import { ProductGrid } from "@/components/ProductGallery/ProductGrid";
import { ProductTable } from "@/components/ProductGallery/ProductTable";
import { ProductPagination } from "@/components/ProductGallery/ProductPagination";
import ProductFilters from "@/components/ProductGallery/ProductFilters";
import { useVendors } from "@/hooks/useVendors";
import { useMediaGroups } from "@/hooks/useMediaGroups";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Table } from "lucide-react";

const ProductGallery = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [filters, setFilters] = useState<FilterValues>({
    search: "",
    vendor: "all",
    dateFrom: undefined,
    dateTo: undefined,
    sortOrder: "desc",
  });
  const { toast } = useToast();
  const vendors = useVendors();
  const { mediaGroups, totalPages } = useMediaGroups(currentPage, filters);

  const handleFilterChange = (newFilters: FilterValues) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Product Gallery</h2>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            onClick={() => setViewMode('grid')}
            size="sm"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            onClick={() => setViewMode('table')}
            size="sm"
          >
            <Table className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ProductFilters
        vendors={vendors}
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      {viewMode === 'grid' ? (
        <ProductGrid mediaGroups={mediaGroups} />
      ) : (
        <ProductTable mediaGroups={mediaGroups} />
      )}
      
      {Object.keys(mediaGroups).length > 0 && (
        <ProductPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
};

export default ProductGallery;