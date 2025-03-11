
import React from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface SearchBarProps {
  searchTerm: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({ 
  searchTerm, 
  onChange,
  className = "w-full sm:w-64 flex-shrink-0"
}) => {
  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Search messages..."
        value={searchTerm}
        onChange={onChange}
        className="pl-9"
      />
    </div>
  );
};
