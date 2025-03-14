
import React from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X, Image, FileVideo, FileText, Music } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface MediaTypeFilterProps {
  mediaTypes: string[];
  setMediaTypes: (types: string[]) => void;
}

export function MediaTypeFilter({ mediaTypes, setMediaTypes }: MediaTypeFilterProps) {
  const mediaTypeOptions = [
    { value: 'image', label: 'Images', icon: <Image className="h-3 w-3 mr-1" /> },
    { value: 'video', label: 'Videos', icon: <FileVideo className="h-3 w-3 mr-1" /> },
    { value: 'application', label: 'Documents', icon: <FileText className="h-3 w-3 mr-1" /> },
    { value: 'audio', label: 'Audio', icon: <Music className="h-3 w-3 mr-1" /> }
  ];
  
  const handleToggleChange = (value: string) => {
    if (mediaTypes.includes(value)) {
      setMediaTypes(mediaTypes.filter(type => type !== value));
    } else {
      setMediaTypes([...mediaTypes, value]);
    }
  };
  
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Media Type</Label>
      <ToggleGroup type="multiple" className="flex flex-wrap gap-2 justify-start">
        {mediaTypeOptions.map((type) => (
          <ToggleGroupItem
            key={type.value}
            value={type.value}
            className="gap-1.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            aria-pressed={mediaTypes.includes(type.value)}
            onClick={() => handleToggleChange(type.value)}
          >
            {type.icon}
            {type.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
