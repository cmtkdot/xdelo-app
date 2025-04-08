
import { MakeEventType } from './MakeEvent';

// Represents a complete automation rule
export interface MakeAutomationRule {
  id: string;
  name: string;
  description?: string | null;
  event_type: MakeEventType | string;
  conditions: MakeRuleCondition[];
  actions: MakeRuleAction[];
  is_active: boolean;
  priority: number;
  created_at?: string | null;
  updated_at?: string | null;
}

// Condition for automation rules
export interface MakeRuleCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'exists' | 'not_exists' | 'matches_regex';
  value: any;
}

// Action to be performed when conditions are met
export interface MakeRuleAction {
  type: 'webhook' | 'notification' | 'update_field' | 'create_record' | 'email' | 'tag' | 'execute_code';
  config: Record<string, any>;
}
