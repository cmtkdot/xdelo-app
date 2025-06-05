import { AnalyzedContent } from "./types.ts";

export function validateAnalyzedContent(content: unknown): boolean {
  // Simplified validation that only checks basic structure
  if (!content || typeof content !== 'object') {
    return false;
  }

  // Type guard to check if content has product_name property
  const hasProductName = (obj: object): obj is { product_name: unknown } => 
    'product_name' in obj;

  // Check if content has product_name property
  if (!hasProductName(content)) {
    return false;
  }

  // Check if product_name is a string
  if (typeof content.product_name !== 'string') {
    return false;
  }

  // All other fields are optional
  return true;
}
