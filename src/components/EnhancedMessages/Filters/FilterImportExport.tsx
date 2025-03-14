
import React from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, FileUp } from 'lucide-react';
import { FilterState } from '@/hooks/useMessagesStore';

interface FilterImportExportProps {
  exportFilters: () => void;
  importFilters: () => void;
}

export function FilterImportExport({ 
  exportFilters,
  importFilters
}: FilterImportExportProps) {
  return (
    <div className="flex gap-2 mt-2">
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
  );
}
