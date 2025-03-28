/**
 * Shared caption parsing utilities for edge functions
 */

export interface ParsedContent {
  product_name: string;
  product_code: string;
  vendor_uid: string | null;
  purchase_date: string | null;
  quantity: number | null;
  notes: string;
  caption: string;
  parsing_metadata: {
    method: 'manual'; // Or potentially 'ai' in the future
    timestamp: string;
    partial_success?: boolean;
    missing_fields?: string[];
    quantity_pattern?: string;
    used_fallback?: boolean;
    original_caption?: string;
    is_edit?: boolean;
    edit_timestamp?: string;
    force_reprocess?: boolean;
    reprocess_timestamp?: string;
    retry_count?: number;
    retry_timestamp?: string;
    error?: string;
  };
  sync_metadata?: {
    media_group_id?: string;
    sync_source_message_id?: string;
  };
}

/**
 * Parse a caption to extract product information
 * @param caption - The caption text to parse
 * @param context - Optional context information for logging
 * @returns The parsed content
 */
export function xdelo_parseCaption(caption: string, context?: {messageId?: string, correlationId?: string}): ParsedContent {
  // Add context to log output
  const logPrefix = context ? `[${context.messageId || 'unknown'}] [${context.correlationId || 'unknown'}] ` : '';
  console.log(`${logPrefix}Starting caption parse: ${caption.length > 50 ? caption.substring(0, 50) + '...' : caption}`);

  // Make sure caption is not empty
  if (!caption || caption.trim() === '') {
    const errorMsg = 'Empty caption provided for parsing';
    console.error(`${logPrefix}${errorMsg}`);
    return {
      product_name: '',
      product_code: '',
      vendor_uid: null,
      purchase_date: null,
      quantity: null,
      notes: '',
      caption: '',
      parsing_metadata: {
        method: 'manual',
        timestamp: new Date().toISOString(),
        error: errorMsg
      }
    };
  }

  const trimmedCaption = caption.trim();
  const currentTimestamp = new Date().toISOString();

  // Initialize with default values
  const parsedContent: ParsedContent = {
    product_name: '',
    product_code: '',
    vendor_uid: null,
    purchase_date: null,
    quantity: null,
    notes: '',
    caption: trimmedCaption,
    parsing_metadata: {
      method: 'manual',
      timestamp: currentTimestamp,
      partial_success: false,
      missing_fields: []
    }
  };

  try {
    // Track missing fields for partial success
    const missingFields: string[] = [];

    // Extract product name (text before '#')
    const productNameMatch = trimmedCaption.match(/^(.*?)(?=#|\n|$)/);
    if (productNameMatch && productNameMatch[1].trim()) {
      parsedContent.product_name = productNameMatch[1].trim();
    } else {
      missingFields.push('product_name');
    }

    // Extract product code (text following '#')
    const productCodeMatch = trimmedCaption.match(/#([A-Za-z0-9-]+)/);
    if (productCodeMatch) {
      parsedContent.product_code = productCodeMatch[1];

      // Extract vendor UID (first 1-4 letters of product code)
      const vendorMatch = productCodeMatch[1].match(/^([A-Za-z]{1,4})/);
      if (vendorMatch) {
        parsedContent.vendor_uid = vendorMatch[1].toUpperCase();
      } else {
        missingFields.push('vendor_uid');
      }

      // Extract purchase date (digits after vendor letters)
      const dateMatch = productCodeMatch[1].match(/^[A-Za-z]{1,4}(\d{5,6})/);
      if (dateMatch) {
        const dateDigits = dateMatch[1];
        try {
          parsedContent.purchase_date = formatPurchaseDate(dateDigits);
        } catch (dateError: unknown) { // Added type annotation
          const dateErrorMessage = dateError instanceof Error ? dateError.message : String(dateError);
          console.log(`${logPrefix}Date parsing error:`, dateErrorMessage);
          missingFields.push('purchase_date');
        }
      } else {
        missingFields.push('purchase_date');
      }
    } else {
      missingFields.push('product_code', 'vendor_uid', 'purchase_date');
    }

    // Extract quantity (number following 'x')
    const quantityMatch = trimmedCaption.match(/x\s*(\d+)/i);
    if (quantityMatch) {
      parsedContent.quantity = parseInt(quantityMatch[1], 10);
      parsedContent.parsing_metadata.quantity_pattern = `x${quantityMatch[1]}`;
    } else {
      // Try alternative quantity patterns
      const altQuantityMatch = trimmedCaption.match(/(?:qty|quantity):\s*(\d+)/i) ||
                               trimmedCaption.match(/(\d+)\s*(?:pcs|pieces|units)/i);

      if (altQuantityMatch) {
        parsedContent.quantity = parseInt(altQuantityMatch[1], 10);
        parsedContent.parsing_metadata.quantity_pattern = altQuantityMatch[0];
      } else {
        missingFields.push('quantity');
      }
    }

    // Extract notes (text in parentheses or remaining text)
    const notesMatch = trimmedCaption.match(/\(([^)]+)\)/);
    if (notesMatch) {
      parsedContent.notes = notesMatch[1].trim();
    } else {
      // Use any text after the product code as notes
      const afterCodeMatch = trimmedCaption.match(/#[A-Za-z0-9-]+(.+)/);
      if (afterCodeMatch && afterCodeMatch[1].trim()) {
        // Remove quantity pattern from notes if present
        let notes = afterCodeMatch[1].trim();
        if (parsedContent.parsing_metadata.quantity_pattern) {
          notes = notes.replace(parsedContent.parsing_metadata.quantity_pattern, '').trim();
        }
        parsedContent.notes = notes;
      }
    }

    // Check if we have at least a product name - this means partial success
    if (parsedContent.product_name) {
      parsedContent.parsing_metadata.partial_success = missingFields.length > 0;
      parsedContent.parsing_metadata.missing_fields = missingFields.length > 0 ? missingFields : undefined;
    }

    console.log(`${logPrefix}Caption parsing completed successfully`);
    return parsedContent;
  } catch (error: unknown) { // Added type annotation
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`${logPrefix}Error parsing caption:`, errorMessage, error);
    parsedContent.parsing_metadata.error = errorMessage;
    return parsedContent;
  }
}

function formatPurchaseDate(dateDigits: string): string {
  // Add leading zero for 5-digit dates (missing leading zero in month)
  const normalizedDigits = dateDigits.length === 5 ? '0' + dateDigits : dateDigits;

  if (normalizedDigits.length !== 6) {
    throw new Error(`Invalid date format: ${dateDigits}`);
  }

  // Format is mmDDyy
  const month = normalizedDigits.substring(0, 2);
  const day = normalizedDigits.substring(2, 4);
  const year = normalizedDigits.substring(4, 6);

  // Convert to YYYY-MM-DD
  const fullYear = '20' + year; // Assuming 20xx year

  // Validate date components
  const monthNum = parseInt(month, 10);
  const dayNum = parseInt(day, 10);
  const yearNum = parseInt(fullYear, 10);

  if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
     throw new Error(`Invalid date components: ${month}/${day}/${year}`);
  }

  // Basic validation, doesn't check days in month perfectly but catches obvious errors
  const dateObj = new Date(Date.UTC(yearNum, monthNum - 1, dayNum)); // Use UTC to avoid timezone issues
  if (isNaN(dateObj.getTime()) || dateObj.getUTCFullYear() !== yearNum || dateObj.getUTCMonth() !== monthNum - 1 || dateObj.getUTCDate() !== dayNum) {
    throw new Error(`Invalid date: ${month}/${day}/${fullYear}`);
  }

  return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`; // Ensure padding
}
