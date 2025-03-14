
import React from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface MediaTypeFilterProps {
  mediaTypes: string[];
  setMediaTypes: (types: string[]) => void;
}

export function MediaTypeFilter({ mediaTypes, setMediaTypes }: MediaTypeFilterProps) {
  const mediaTypeOptions = [
    { value: 'image', label: 'Images' },
    { value: 'video', label: 'Videos' },
    { value: 'application', label: 'Documents' },
    { value: 'audio', label: 'Audio' }
  ];
  
  return (
    <div className="space-y-2">
      <Label>Media Type</Label>
      <div className="flex flex-wrap gap-2">
        {mediaTypeOptions.map((type) => (
          <Badge
            key={type.value}
            variant={mediaTypes.includes(type.value) ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => {
              setMediaTypes(
                mediaTypes.includes(type.value)
                  ? mediaTypes.filter((t) => t !== type.value)
                  : [...mediaTypes, type.value]
              );
            }}
          >
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
