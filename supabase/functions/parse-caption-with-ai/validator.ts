import { ParsedContent, QuantityParseResult } from './types.ts';

export function validateParsedContent(content: ParsedContent): boolean {
  // Only require that content is an object and has a product name
  return content && typeof content === 'object' && typeof content.product_name === 'string';
}

export function validateQuantityResult(quantity: QuantityParseResult): boolean {
  return (
    quantity.value > 0 &&
    quantity.value < 10000 &&
    quantity.confidence > 0.4
  );
}

export function validateAnalyzedContent(content: any): boolean {
  // Simplified validation that only checks basic structure
  if (!content || typeof content !== 'object') {
    return false;
  }

  // Only require product_name
  if (!content.product_name || typeof content.product_name !== 'string') {
    return false;
  }

  // All other fields are optional
  return true;
}