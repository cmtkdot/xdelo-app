import { Button } from "@/components/ui/button";
import { Grid3X3, ImageIcon, Film, Grid, Table } from "lucide-react";

interface GalleryFiltersProps {
  filter: string;
  setFilter: (filter: string) => void;
  viewMode: 'grid' | 'table';
  setViewMode: (mode: 'grid' | 'table') => void;
}

export const GalleryFilters = ({ filter, setFilter, viewMode, setViewMode }: GalleryFiltersProps) => {
  return (
    <div className="flex flex-wrap justify-between gap-2 mb-4">
      <div className="flex flex-wrap gap-2">
        <Button 
          variant={filter === "all" ? "default" : "outline"} 
          onClick={() => setFilter("all")}
          className="transition-all duration-200 ease-in-out"
          size="sm"
        >
          <Grid3X3 className="mr-2 h-4 w-4" />
          All
        </Button>
        <Button 
          variant={filter === "images" ? "default" : "outline"} 
          onClick={() => setFilter("images")}
          className="transition-all duration-200 ease-in-out"
          size="sm"
        >
          <ImageIcon className="mr-2 h-4 w-4" />
          Images
        </Button>
        <Button 
          variant={filter === "videos" ? "default" : "outline"} 
          onClick={() => setFilter("videos")}
          className="transition-all duration-200 ease-in-out"
          size="sm"
        >
          <Film className="mr-2 h-4 w-4" />
          Videos
        </Button>
      </div>
      
      <div className="flex gap-2">
        <Button 
          variant={viewMode === "grid" ? "default" : "outline"} 
          onClick={() => setViewMode("grid")}
          className="transition-all duration-200 ease-in-out"
          size="sm"
        >
          <Grid className="mr-2 h-4 w-4" />
          Grid
        </Button>
        <Button 
          variant={viewMode === "table" ? "default" : "outline"} 
          onClick={() => setViewMode("table")}
          className="transition-all duration-200 ease-in-out"
          size="sm"
        >
          <Table className="mr-2 h-4 w-4" />
          Table
        </Button>
      </div>
    </div>
  );
};
