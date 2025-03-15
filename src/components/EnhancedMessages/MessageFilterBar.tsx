
import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Filter, MoreHorizontal, Copy, Trash2 } from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MessageFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  isFilterOpen: boolean;
  toggleFilter: () => void;
  showMode: 'list' | 'grid';
  onToggleShowMode: () => void;
  clearSelection: () => void;
  getSelectedMessageIds: () => string[];
}

export const MessageFilterBar: React.FC<MessageFilterBarProps> = ({
  search,
  onSearchChange,
  isFilterOpen,
  toggleFilter,
  showMode,
  onToggleShowMode,
  clearSelection,
  getSelectedMessageIds
}) => {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center space-x-2">
        <Input
          type="text"
          placeholder="Search messages..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <Button variant="outline" size="icon" onClick={toggleFilter}>
          <Filter className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center space-x-2">
        <Button variant="outline" size="sm" onClick={onToggleShowMode}>
          Show {showMode === 'grid' ? 'List' : 'Grid'}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Actions <MoreHorizontal className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => clearSelection()}>
              Clear Selection <Copy className="ml-auto h-4 w-4" />
            </DropdownMenuItem>
            <DropdownMenuItem disabled={getSelectedMessageIds().length === 0}>
              Delete Selected <Trash2 className="ml-auto h-4 w-4" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
