
import React from 'react';

interface MessageFilterPanelProps {
  isVisible: boolean;
}

export const MessageFilterPanel: React.FC<MessageFilterPanelProps> = ({ isVisible }) => {
  if (!isVisible) return null;
  
  return (
    <div className="mb-4 p-4 border rounded-md">
      <h3 className="text-lg font-semibold mb-2">Filters</h3>
      {/* Add filter components here */}
      <p>Filter options will be added here.</p>
    </div>
  );
};
