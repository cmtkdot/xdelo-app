
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectGroup, 
  SelectItem, 
  SelectLabel, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { FileDown, FileUp, Save } from 'lucide-react';
import { FilterState } from '@/hooks/useMessagesStore';

interface FilterPresetsProps {
  presetName: string;
  setPresetName: (name: string) => void;
  presetFilters: Record<string, Partial<FilterState>>;
  handleSavePreset: () => void;
  handleLoadPreset: (name: string) => void;
  exportFilters: () => void;
  importFilters: () => void;
}

export function FilterPresets({ 
  presetName, 
  setPresetName, 
  presetFilters, 
  handleSavePreset, 
  handleLoadPreset,
  exportFilters,
  importFilters
}: FilterPresetsProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Filter Presets</h4>
      
      <div className="flex gap-2">
        <Input
          placeholder="Preset name"
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          className="flex-1"
        />
        <Button 
          variant="outline" 
          onClick={handleSavePreset} 
          disabled={!presetName.trim()}
          size="icon"
        >
          <Save className="h-4 w-4" />
        </Button>
      </div>
      
      {Object.keys(presetFilters).length > 0 && (
        <div className="space-y-2">
          <Label>Saved Presets</Label>
          <Select onValueChange={handleLoadPreset}>
            <SelectTrigger>
              <SelectValue placeholder="Select a preset" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Presets</SelectLabel>
                {Object.keys(presetFilters).map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      )}
      
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1 gap-1"
          onClick={exportFilters}
        >
          <FileDown className="h-4 w-4" />
          Export
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1 gap-1"
          onClick={importFilters}
        >
          <FileUp className="h-4 w-4" />
          Import
        </Button>
      </div>
    </div>
  );
}
