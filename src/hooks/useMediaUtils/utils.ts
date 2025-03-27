
import { MediaProcessingState, ContentValidationRules, ValidationResult } from './types';

/**
 * Creates a state for tracking media processing status
 */
export function createMediaProcessingState(): [
  MediaProcessingState, 
  { 
    setIsProcessing: (isProcessing: boolean) => void;
    addProcessingMessageId: (id: string) => void;
    removeProcessingMessageId: (id: string) => void;
  }
] {
  // Initial state
  const state: MediaProcessingState = {
    isProcessing: false,
    processingMessageIds: {}
  };
  
  // Actions
  const actions = {
    setIsProcessing: (isProcessing: boolean) => {
      state.isProcessing = isProcessing;
    },
    addProcessingMessageId: (id: string) => {
      state.processingMessageIds[id] = true;
    },
    removeProcessingMessageId: (id: string) => {
      delete state.processingMessageIds[id];
    }
  };
  
  return [state, actions];
}

/**
 * Retry mechanism for network requests
 */
export async function withRetry<T>(
  fn: () => Promise<T>, 
  options = { maxAttempts: 3, delay: 1000, retryableErrors: ['timeout', 'connection'] }
): Promise<T> {
  let attempts = 0;
  
  while (attempts < options.maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      attempts++;
      
      // If this was the last attempt, throw the error
      if (attempts >= options.maxAttempts) {
        throw error;
      }
      
      // Check if this error type is retryable
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
      const isRetryable = options.retryableErrors.some(type => errorMessage.includes(type));
      
      if (!isRetryable) {
        throw error;
      }
      
      // Wait before retry (with exponential backoff)
      const backoffDelay = options.delay * Math.pow(2, attempts - 1);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
  
  throw new Error('Retry failed: Maximum attempts reached');
}

/**
 * Validates content against a set of rules
 */
export function validateContent(
  content: Record<string, any>,
  rules: ContentValidationRules = standardContentValidationRules
): ValidationResult {
  // Initialize result
  const result: ValidationResult = {
    valid: true,
    missing_fields: [],
    invalid_formats: [],
    custom_errors: {}
  };
  
  // Check required fields
  if (rules.required) {
    for (const field of rules.required) {
      if (!content[field] || content[field] === '') {
        result.missing_fields.push(field);
        result.valid = false;
      }
    }
  }
  
  // Check format rules
  if (rules.format) {
    for (const [field, pattern] of Object.entries(rules.format)) {
      if (content[field] && content[field] !== '') {
        let regex: RegExp;
        if (typeof pattern === 'string') {
          regex = new RegExp(pattern);
        } else {
          regex = pattern;
        }
        
        if (!regex.test(String(content[field]))) {
          result.invalid_formats.push(field);
          result.valid = false;
        }
      }
    }
  }
  
  // Check custom validation rules
  if (rules.custom) {
    for (const [field, validator] of Object.entries(rules.custom)) {
      if (content[field] !== undefined) {
        if (!validator(content[field])) {
          result.custom_errors[field] = `Invalid value for ${field}`;
          result.valid = false;
        }
      }
    }
  }
  
  return result;
}

// Standard validation rules to use by default
export const standardContentValidationRules: ContentValidationRules = {
  required: ['product_name', 'product_code'],
  format: {
    product_code: /^[A-Za-z]{1,4}\d{5,6}(?:-[A-Za-z0-9-]+)?$/,
    purchase_date: /^\d{4}-\d{2}-\d{2}$/,
  },
  custom: {
    quantity: (value) => typeof value === 'number' && value > 0,
  }
};
