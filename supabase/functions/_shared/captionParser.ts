
// Shared caption parsing functionality for Edge Functions

export interface ParsedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string; 
  purchase_date?: string;
  quantity?: number;
  unit_price?: number;
  total_price?: number;
  notes?: string;
  caption?: string;
  parsing_metadata: {
    method: 'manual' | 'ai';
    timestamp: string;
    partial_success?: boolean;
    missing_fields?: string[];
    quantity_pattern?: string;
    is_edit?: boolean;
    edit_timestamp?: string;
    force_reprocess?: boolean;
    reprocess_timestamp?: string;
    retry_count?: number;
    retry_timestamp?: string;
  };
  sync_metadata?: {
    sync_source_message_id?: string;
    media_group_id?: string;
  };
}

export function xdelo_parseCaption(caption: string): ParsedContent {
  // Remove any leading/trailing whitespace
  const trimmedCaption = caption.trim();
  const timestamp = new Date().toISOString();
  
  // Initialize the result
  const result: ParsedContent = {
    product_name: '',
    product_code: '',
    vendor_uid: undefined,
    purchase_date: undefined,
    quantity: undefined,
    notes: '',
    caption: trimmedCaption,
    parsing_metadata: {
      method: 'manual',
      timestamp,
      partial_success: false
    }
  };
  
  // Basic extraction logic (this is a simplified version)
  // In a real implementation, you'd have more sophisticated parsing
  
  // Extract product code if it exists (format: #CODE)
  const codeMatch = trimmedCaption.match(/#([A-Za-z0-9-]+)/);
  if (codeMatch) {
    result.product_code = codeMatch[1];
    
    // Extract vendor UID (first few letters of the code)
    const vendorMatch = result.product_code.match(/^([A-Za-z]{1,4})/);
    if (vendorMatch) {
      result.vendor_uid = vendorMatch[1].toUpperCase();
    }
    
    // Extract date if it follows the vendor code (format: VENDOR123456)
    const dateMatch = result.product_code.match(/^[A-Za-z]{1,4}(\d{6})/);
    if (dateMatch) {
      const dateStr = dateMatch[1];
      // Format as YYYY-MM-DD (assuming mmddyy format in the code)
      const month = dateStr.substring(0, 2);
      const day = dateStr.substring(2, 4);
      const year = `20${dateStr.substring(4, 6)}`;
      result.purchase_date = `${year}-${month}-${day}`;
    }
  }
  
  // Extract quantity if it exists (format: x Number or Number x)
  const qtyMatch = trimmedCaption.match(/x\s*(\d+)/) || trimmedCaption.match(/(\d+)\s*x/);
  if (qtyMatch) {
    result.quantity = parseInt(qtyMatch[1], 10);
  }
  
  // Extract product name (everything before the first special character or # or x)
  let productNameEndIndex = trimmedCaption.length;
  const specialCharIndices = [
    trimmedCaption.indexOf('#'),
    trimmedCaption.indexOf('x '),
    trimmedCaption.indexOf(' x'),
    trimmedCaption.indexOf('(')
  ].filter(index => index > 0);
  
  if (specialCharIndices.length > 0) {
    productNameEndIndex = Math.min(...specialCharIndices);
  }
  
  result.product_name = trimmedCaption.substring(0, productNameEndIndex).trim();
  
  // Extract notes (content in parentheses)
  const notesMatch = trimmedCaption.match(/\((.*?)\)/);
  if (notesMatch) {
    result.notes = notesMatch[1].trim();
  }
  
  // Check if we're missing any required fields
  const missingFields = [];
  if (!result.product_name) missingFields.push('product_name');
  if (!result.product_code) missingFields.push('product_code');
  if (!result.vendor_uid) missingFields.push('vendor_uid');
  if (!result.purchase_date) missingFields.push('purchase_date');
  if (!result.quantity) missingFields.push('quantity');
  
  // Set partial success flag if we're missing any fields
  if (missingFields.length > 0) {
    result.parsing_metadata.partial_success = true;
    result.parsing_metadata.missing_fields = missingFields;
  }
  
  return result;
}
