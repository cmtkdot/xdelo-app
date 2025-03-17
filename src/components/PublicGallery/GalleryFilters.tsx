
import { Button } from "@/components/ui/button";
import { Grid3X3, ImageIcon, Film } from "lucide-react";

interface GalleryFiltersProps {
  filter: string;
  setFilter: (filter: string) => void;
}

export const GalleryFilters = ({ filter, setFilter }: GalleryFiltersProps) => {
  return (
    <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-4">
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
  );
};
