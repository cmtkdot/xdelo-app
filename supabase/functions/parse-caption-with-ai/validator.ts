import { ParsedContent, QuantityParseResult } from './types.ts';

export function validateParsedContent(content: ParsedContent): boolean {
  const hasRequiredFields = !!(
    content.product_name &&
    content.product_name !== 'Untitled Product'
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

  // Only require product_name
  if (!content.product_name || typeof content.product_name !== 'string') {
    return false;
  }

  // Optional fields should be of correct type if present
  if (content.product_code && typeof content.product_code !== 'string') {
    return false;
  }

  if (content.vendor_uid && typeof content.vendor_uid !== 'string') {
    return false;
  }

  if (content.quantity !== undefined && content.quantity !== null && 
      (typeof content.quantity !== 'number' || 
       content.quantity <= 0 || 
       content.quantity >= 10000)) {
    return false;
  }

  if (content.purchase_date) {
    const date = new Date(content.purchase_date);
    if (isNaN(date.getTime()) || date > new Date()) {
      return false;
    }
  }

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