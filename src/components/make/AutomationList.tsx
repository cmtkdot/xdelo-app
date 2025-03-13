import React from 'react';
import { useMakeAutomations } from '@/hooks/useMakeAutomations';
import { MakeAutomationRule } from '@/types/make';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { MoreVertical, Pencil, Trash2, ChevronsUp, ChevronsDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

interface AutomationListProps {
  onEditRule?: (rule: MakeAutomationRule) => void;
}

const AutomationList = ({ onEditRule }: AutomationListProps) => {
  const {
    useAutomationRules,
    toggleAutomationRule,
    deleteAutomationRule,
    reorderAutomationRules
  } = useMakeAutomations();
  
  const { data: automations, isLoading } = useAutomationRules();
  const [rules, setRules] = React.useState<MakeAutomationRule[]>([]);
  
  React.useEffect(() => {
    if (automations) {
      setRules(automations);
    }
  }, [automations]);

  const handleToggleRule = async (id: string, isActive: boolean) => {
    toggleAutomationRule.mutate({ id, isActive });
  };

  const handleDeleteRule = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this automation rule?')) {
      deleteAutomationRule.mutate(id);
    }
  };
  
  const handleEditRule = (rule: MakeAutomationRule) => {
    if (onEditRule) {
      onEditRule(rule);
    }
  };
  
  const handleMovePriority = (id: string, direction: 'up' | 'down') => {
    const newRules = [...rules];
    const index = newRules.findIndex(rule => rule.id === id);
    
    if (index === -1) return;
    
    if (direction === 'up' && index > 0) {
      // Move up (higher priority)
      [newRules[index - 1], newRules[index]] = [newRules[index], newRules[index - 1]];
    } else if (direction === 'down' && index < newRules.length - 1) {
      // Move down (lower priority)
      [newRules[index], newRules[index + 1]] = [newRules[index + 1], newRules[index]];
    }
    
    setRules(newRules);
    reorderAutomationRules.mutate(newRules.map((rule, index) => ({
      id: rule.id,
      priority: newRules.length - index // Higher priority for lower index
    })));
  };
  
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    
    const items = Array.from(rules);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setRules(items);
    reorderAutomationRules.mutate(items.map((rule, index) => ({
      id: rule.id,
      priority: items.length - index // Higher priority for lower index
    })));
  };

  if (isLoading) {
    return <div>Loading automations...</div>;
  }

  if (!rules?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No automations found. Create your first automation to get started.
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="automations">
        {(provided) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className="space-y-4"
          >
            {rules.map((automation, index) => (
              <Draggable key={automation.id} draggableId={automation.id} index={index}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className="border rounded-lg p-4 bg-background"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{automation.name}</h3>
                          <Badge variant="outline">{automation.event_type}</Badge>
                          <Badge variant={automation.is_active ? "default" : "secondary"}>
                            {automation.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {automation.description || 'No description provided'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMovePriority(automation.id, 'up')}
                            disabled={index === 0}
                          >
                            <ChevronsUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMovePriority(automation.id, 'down')}
                            disabled={index === rules.length - 1}
                          >
                            <ChevronsDown className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <Switch
                          checked={automation.is_active ?? false}
                          onCheckedChange={(checked) => handleToggleRule(automation.id, checked)}
                        />
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditRule(automation)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteRule(automation.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};

export default AutomationList; 