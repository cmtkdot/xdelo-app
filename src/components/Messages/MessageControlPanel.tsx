
import React from 'react';
import { SearchBar } from './SearchBar';
import { ActionButtons } from './ActionButtons';
import { ProcessingRepairButton } from '@/components/ProductGallery/ProcessingRepairButton';

interface MessageControlPanelProps {
  searchTerm: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRefresh: () => void;
  onQueueUnprocessed: () => Promise<void>;
  onProcessQueue: () => Promise<void>;
  isProcessingAny: boolean;
  isRefreshing: boolean;
}

export const MessageControlPanel: React.FC<MessageControlPanelProps> = ({
  searchTerm,
  onSearchChange,
  onRefresh,
  onQueueUnprocessed,
  onProcessQueue,
  isProcessingAny,
  isRefreshing
}) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <SearchBar 
          searchTerm={searchTerm} 
          onChange={onSearchChange} 
        />
        
        <ActionButtons 
          onRefresh={onRefresh}
          onQueueUnprocessed={onQueueUnprocessed}
          onProcessQueue={onProcessQueue}
          isProcessingAny={isProcessingAny}
          isRefreshing={isRefreshing}
        />
      </div>
      
      <ProcessingRepairButton />
    </div>
  );
};
