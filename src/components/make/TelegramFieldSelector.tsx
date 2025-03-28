
import React, { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Search, CheckSquare, Square, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Message } from '@/types/entities/Message';

// Define available fields from Message type
const getAvailableFields = () => {
  const messageFields: Array<{
    field: string;
    type: string;
    description: string;
    nested?: boolean;
    category: string;
  }> = [
    { field: 'id', type: 'string', description: 'Unique identifier for the message', category: 'Basic' },
    { field: 'telegram_message_id', type: 'number', description: 'Original Telegram message ID', category: 'Basic' },
    { field: 'caption', type: 'string', description: 'Caption text of the message', category: 'Content' },
    { field: 'public_url', type: 'string', description: 'Public URL to access the media', category: 'Media' },
    { field: 'storage_path', type: 'string', description: 'Storage path of the media file', category: 'Media' },
    { field: 'mime_type', type: 'string', description: 'MIME type of the media', category: 'Media' },
    { field: 'file_size', type: 'number', description: 'Size of the file in bytes', category: 'Media' },
    { field: 'width', type: 'number', description: 'Width of the media (images/videos)', category: 'Media' },
    { field: 'height', type: 'number', description: 'Height of the media (images/videos)', category: 'Media' },
    { field: 'duration', type: 'number', description: 'Duration of the media in seconds (videos/audio)', category: 'Media' },
    { field: 'file_id', type: 'string', description: 'Telegram file ID', category: 'Telegram' },
    { field: 'file_unique_id', type: 'string', description: 'Unique identifier for Telegram file', category: 'Telegram' },
    { field: 'chat_id', type: 'number', description: 'ID of the chat where message was sent', category: 'Chat' },
    { field: 'chat_type', type: 'string', description: 'Type of chat (private, group, etc.)', category: 'Chat' },
    { field: 'chat_title', type: 'string', description: 'Title of the chat', category: 'Chat' },
    { field: 'media_group_id', type: 'string', description: 'ID for grouped media messages', category: 'Media' },
    { field: 'message_url', type: 'string', description: 'URL to the message in Telegram', category: 'Telegram' },
    { field: 'telegram_data', type: 'object', description: 'Raw Telegram message data', nested: true, category: 'Advanced' },
    { field: 'processing_state', type: 'string', description: 'Current processing state of the message', category: 'Processing' },
    { field: 'analyzed_content', type: 'object', description: 'Analyzed content from the message', nested: true, category: 'Analysis' },
    { field: 'is_forward', type: 'boolean', description: 'Whether the message is forwarded', category: 'Forwarding' },
    { field: 'forward_from', type: 'object', description: 'Information about the original sender', nested: true, category: 'Forwarding' },
    { field: 'forward_from_chat', type: 'object', description: 'Information about the original chat', nested: true, category: 'Forwarding' },
    { field: 'edited_at', type: 'string', description: 'When the message was last edited', category: 'Editing' },
    { field: 'edit_history', type: 'array', description: 'History of message edits', nested: true, category: 'Editing' },
    { field: 'created_at', type: 'string', description: 'When the message was created in our system', category: 'Timestamps' },
    { field: 'updated_at', type: 'string', description: 'When the message was last updated in our system', category: 'Timestamps' },
    { field: 'telegram_date', type: 'string', description: 'Original Telegram timestamp', category: 'Timestamps' },
  ];
  
  return messageFields;
};

interface TelegramFieldSelectorProps {
  selectedFields: string[];
  onChange: (fields: string[]) => void;
  mode: 'include' | 'exclude';
  onModeChange: (mode: 'include' | 'exclude') => void;
}

const TelegramFieldSelector: React.FC<TelegramFieldSelectorProps> = ({
  selectedFields,
  onChange,
  mode,
  onModeChange
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const availableFields = getAvailableFields();
  
  // Get unique categories
  const categories = [...new Set(availableFields.map(field => field.category))];
  
  // Filter fields based on search and category
  const filteredFields = availableFields.filter(field => {
    const matchesSearch = !searchQuery || 
      field.field.toLowerCase().includes(searchQuery.toLowerCase()) ||
      field.description.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesCategory = !selectedCategory || field.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });
  
  const handleToggleField = (field: string) => {
    if (selectedFields.includes(field)) {
      onChange(selectedFields.filter(f => f !== field));
    } else {
      onChange([...selectedFields, field]);
    }
  };
  
  const handleToggleAllInCategory = (category: string, select: boolean) => {
    const categoryFields = availableFields
      .filter(field => field.category === category)
      .map(field => field.field);
      
    if (select) {
      // Add all fields from this category that aren't already selected
      const fieldsToAdd = categoryFields.filter(field => !selectedFields.includes(field));
      onChange([...selectedFields, ...fieldsToAdd]);
    } else {
      // Remove all fields from this category
      onChange(selectedFields.filter(field => !categoryFields.includes(field)));
    }
  };
  
  const handleSelectAll = (select: boolean) => {
    if (select) {
      onChange(availableFields.map(field => field.field));
    } else {
      onChange([]);
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 justify-between">
        <div className="flex items-center gap-2">
          <Button 
            variant={mode === 'include' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => onModeChange('include')}
          >
            Include Mode
          </Button>
          <Button 
            variant={mode === 'exclude' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => onModeChange('exclude')}
          >
            Exclude Mode
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleSelectAll(true)}
            title="Select All Fields"
          >
            <CheckSquare className="h-4 w-4 mr-2" />
            All
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleSelectAll(false)}
            title="Clear Selection"
          >
            <Square className="h-4 w-4 mr-2" />
            None
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              // Reset to sensible defaults
              onChange([
                'id', 'telegram_message_id', 'caption', 'public_url', 
                'mime_type', 'file_size', 'chat_id', 'chat_title'
              ]);
            }}
            title="Reset to Default Fields"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>
      
      <div className="flex items-center space-x-2 mb-4">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search fields..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
        />
      </div>
      
      <div className="flex flex-wrap gap-2 mb-4">
        <Badge 
          variant={selectedCategory === null ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => setSelectedCategory(null)}
        >
          All Categories
        </Badge>
        {categories.map(category => (
          <Badge 
            key={category}
            variant={selectedCategory === category ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setSelectedCategory(category === selectedCategory ? null : category)}
          >
            {category}
          </Badge>
        ))}
      </div>
      
      <ScrollArea className="h-[400px] pr-4 rounded border p-4">
        <Accordion type="multiple" className="w-full">
          {categories.map(category => {
            const categoryFields = filteredFields.filter(field => field.category === category);
            if (categoryFields.length === 0) return null;
            
            const allSelected = categoryFields.every(field => 
              selectedFields.includes(field.field)
            );
            
            const someSelected = categoryFields.some(field => 
              selectedFields.includes(field.field)
            );
            
            return (
              <AccordionItem key={category} value={category}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center">
                    <Checkbox 
                      id={`category-${category}`}
                      checked={allSelected}
                      className={someSelected && !allSelected ? "opacity-50" : ""}
                      onCheckedChange={(checked) => {
                        handleToggleAllInCategory(category, checked === true);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="ml-2">{category}</span>
                    <Badge variant="outline" className="ml-2">
                      {categoryFields.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pl-6">
                    {categoryFields.map(field => (
                      <div key={field.field} className="flex items-start space-x-2">
                        <Checkbox 
                          id={`field-${field.field}`}
                          checked={selectedFields.includes(field.field)}
                          onCheckedChange={() => handleToggleField(field.field)}
                        />
                        <div className="grid gap-1.5 leading-none">
                          <Label 
                            htmlFor={`field-${field.field}`}
                            className="cursor-pointer"
                          >
                            {field.field}
                            {field.nested && (
                              <Badge variant="outline" className="ml-2">nested</Badge>
                            )}
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            {field.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </ScrollArea>
      
      <div className="text-sm text-muted-foreground mt-2">
        {selectedFields.length} fields selected
      </div>
    </div>
  );
};

export default TelegramFieldSelector;
