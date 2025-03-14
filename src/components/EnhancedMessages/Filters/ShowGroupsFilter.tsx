
import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface ShowGroupsFilterProps {
  showGroups: boolean;
  setShowGroups: (show: boolean) => void;
}

export function ShowGroupsFilter({ showGroups, setShowGroups }: ShowGroupsFilterProps) {
  return (
    <div className="flex items-center space-x-2">
      <Checkbox 
        id="show-groups" 
        checked={showGroups} 
        onCheckedChange={(checked) => setShowGroups(Boolean(checked))} 
      />
      <Label htmlFor="show-groups">Show Media Groups</Label>
    </div>
  );
}
