
import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface ShowGroupsFilterProps {
  showGroups: boolean;
  setShowGroups: (show: boolean) => void;
  groupCount?: number;
}

export function ShowGroupsFilter({ 
  showGroups, 
  setShowGroups,
  groupCount 
}: ShowGroupsFilterProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="show-groups" className="text-sm font-medium">Media Groups</Label>
        {groupCount !== undefined && (
          <Badge variant="outline" className="text-xs">
            {groupCount}
          </Badge>
        )}
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox 
          id="show-groups" 
          checked={showGroups} 
          onCheckedChange={(checked) => setShowGroups(Boolean(checked))} 
        />
        <Label 
          htmlFor="show-groups" 
          className="text-sm text-muted-foreground cursor-pointer"
        >
          Show grouped media items
        </Label>
      </div>
    </div>
  );
}
