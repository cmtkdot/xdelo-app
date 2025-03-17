
import React from "react";
import { Button } from "@/components/ui/button";
import { Grid3X3, ImageIcon, Film } from "lucide-react";
import { cn } from "@/lib/utils";

interface GalleryFiltersProps {
  filter: string;
  setFilter: (filter: string) => void;
  className?: string;
}

export const GalleryFilters: React.FC<GalleryFiltersProps> = ({ 
  filter, 
  setFilter,
  className 
}) => {
  return (
    <div className={cn(
      "flex flex-wrap justify-center md:justify-start gap-1.5 md:gap-2",
      className
    )}>
      <Button 
        variant={filter === "all" ? "default" : "outline"} 
        onClick={() => setFilter("all")}
        className="transition-all duration-200 ease-in-out h-8 px-2.5 text-xs md:h-9 md:px-4 md:text-sm"
        size="sm"
      >
        <Grid3X3 className="mr-1.5 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4" />
        All
      </Button>
      <Button 
        variant={filter === "images" ? "default" : "outline"} 
        onClick={() => setFilter("images")}
        className="transition-all duration-200 ease-in-out h-8 px-2.5 text-xs md:h-9 md:px-4 md:text-sm"
        size="sm"
      >
        <ImageIcon className="mr-1.5 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4" />
        Images
      </Button>
      <Button 
        variant={filter === "videos" ? "default" : "outline"} 
        onClick={() => setFilter("videos")}
        className="transition-all duration-200 ease-in-out h-8 px-2.5 text-xs md:h-9 md:px-4 md:text-sm"
        size="sm"
      >
        <Film className="mr-1.5 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4" />
        Videos
      </Button>
    </div>
  );
};
