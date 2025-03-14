
import React from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { ProcessingState } from '@/types';

interface ProcessingStateFilterProps {
  processingStates: ProcessingState[];
  setProcessingStates: (states: ProcessingState[]) => void;
}

export function ProcessingStateFilter({ 
  processingStates = [], 
  setProcessingStates 
}: ProcessingStateFilterProps) {
  // Ensure processingStates is always an array
  const safeProcessingStates = Array.isArray(processingStates) ? processingStates : [];
  
  const processingStateOptions: ProcessingState[] = [
    'completed', 'processing', 'error', 'pending', 'initialized'
  ];
  
  return (
    <div className="space-y-2">
      <Label>Processing State</Label>
      <div className="flex flex-wrap gap-2">
        {processingStateOptions.map((state) => (
          <Badge
            key={state}
            variant={safeProcessingStates.includes(state) ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => {
              setProcessingStates(
                safeProcessingStates.includes(state)
                  ? safeProcessingStates.filter((s) => s !== state)
                  : [...safeProcessingStates, state]
              );
            }}
          >
            {state}
            {safeProcessingStates.includes(state) && (
              <X className="ml-1 h-3 w-3" />
            )}
          </Badge>
        ))}
      </div>
    </div>
  );
}
