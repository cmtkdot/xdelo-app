
import { Message } from '@/types/entities/Message';

/**
 * Safely get product-related fields from a message by checking both direct properties 
 * and analyzed_content
 */
export const getMessageProperty = (
  message: Message | null | undefined, 
  property: string, 
  defaultValue: any = null
): any => {
  if (!message) return defaultValue;
  
  // First check if the property exists directly on the message
  if (property in message && (message as any)[property] !== undefined && (message as any)[property] !== null) {
    return (message as any)[property];
  }
  
  // Then check in analyzed_content
  if (message.analyzed_content && typeof message.analyzed_content === 'object') {
    if (property in message.analyzed_content && message.analyzed_content[property] !== undefined && message.analyzed_content[property] !== null) {
      return message.analyzed_content[property];
    }
  }
  
  return defaultValue;
};

/**
 * Get product name from message
 */
export const getProductName = (message: Message | null | undefined): string | null => {
  return getMessageProperty(message, 'product_name', null);
};

/**
 * Get product code from message
 */
export const getProductCode = (message: Message | null | undefined): string | null => {
  return getMessageProperty(message, 'product_code', null);
};

/**
 * Get vendor UID from message
 */
export const getVendorUid = (message: Message | null | undefined): string | null => {
  return getMessageProperty(message, 'vendor_uid', null);
};

/**
 * Get purchase date from message
 */
export const getPurchaseDate = (message: Message | null | undefined): string | null => {
  return getMessageProperty(message, 'purchase_date', null);
};

/**
 * Get product quantity from message
 */
export const getProductQuantity = (message: Message | null | undefined): number | string | null => {
  return getMessageProperty(message, 'product_quantity', null);
};

/**
 * Get notes from message
 */
export const getNotes = (message: Message | null | undefined): string | null => {
  return getMessageProperty(message, 'notes', null);
};

/**
 * Check if a message has valid product information
 */
export const hasProductInfo = (message: Message | null | undefined): boolean => {
  return !!getProductName(message) || !!getProductCode(message);
};
