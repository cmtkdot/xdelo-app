
import React from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X, Image, FileVideo, FileText, Music } from 'lucide-react';

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
  
  const toggleMediaType = (value: string) => {
    if (mediaTypes.includes(value)) {
      setMediaTypes(mediaTypes.filter(type => type !== value));
    } else {
      setMediaTypes([...mediaTypes, value]);
    }
  };
  
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Media Type</Label>
      <div className="flex flex-wrap gap-2">
        {mediaTypeOptions.map((type) => (
          <Badge
            key={type.value}
            variant={mediaTypes.includes(type.value) ? "default" : "outline"}
            className="cursor-pointer flex items-center"
            onClick={() => toggleMediaType(type.value)}
          >
            {type.icon}
            {type.label}
            {mediaTypes.includes(type.value) && (
              <X className="ml-1 h-3 w-3" />
            )}
          </Badge>
        ))}
      </div>
    </div>
  );
}
