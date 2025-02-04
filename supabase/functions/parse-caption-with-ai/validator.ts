import { ParsedContent, QuantityParseResult } from './types.ts';

export function validateParsedContent(content: ParsedContent): boolean {
  const hasRequiredFields = !!(
    content.product_name &&
    content.product_name !== 'Untitled Product' &&
    content.product_code &&
    content.vendor_uid
  );

  const hasValidDate = !content.purchase_date || (
    new Date(content.purchase_date) <= new Date() &&
    !isNaN(new Date(content.purchase_date).getTime())
  );

  const hasValidQuantity = !content.quantity || (
    content.quantity > 0 && 
    content.quantity < 10000
  );

  return hasRequiredFields && hasValidDate && hasValidQuantity;
}

export function validateQuantityResult(quantity: QuantityParseResult): boolean {
  return (
    quantity.value > 0 &&
    quantity.value < 10000 &&
    quantity.confidence > 0.4
  );
}

export function validateAnalyzedContent(content: any): boolean {
  if (!content || typeof content !== 'object') {
    return false;
  }

  // Check if it has the basic structure
  if (!content.product_name || typeof content.product_name !== 'string') {
    return false;
  }

  // Check for valid product code if present
  if (content.product_code && typeof content.product_code !== 'string') {
    return false;
  }

  // Check for valid vendor UID if present
  if (content.vendor_uid && typeof content.vendor_uid !== 'string') {
    return false;
  }

  // Check for valid quantity if present
  if (content.quantity !== undefined && 
      (typeof content.quantity !== 'number' || 
       content.quantity <= 0 || 
       content.quantity >= 10000)) {
    return false;
  }

  // Check for valid purchase date if present
  if (content.purchase_date) {
    const date = new Date(content.purchase_date);
    if (isNaN(date.getTime()) || date > new Date()) {
      return false;
    }
  }

  // Check for valid parsing metadata
  if (content.parsing_metadata) {
    if (typeof content.parsing_metadata !== 'object' ||
        typeof content.parsing_metadata.method !== 'string' ||
        typeof content.parsing_metadata.confidence !== 'number' ||
        content.parsing_metadata.confidence < 0 ||
        content.parsing_metadata.confidence > 1) {
      return false;
    }
  }

  return true;
}