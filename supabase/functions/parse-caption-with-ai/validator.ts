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