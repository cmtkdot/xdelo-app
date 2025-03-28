
import { AnalyzedContent, ParsedContent, ParsingStage } from "./types.ts";

/**
 * Improved caption parser (V2) with enhanced structure and reliability
 * 
 * This parser is more structured and uses a stage-based approach for better 
 * maintainability and error tracking. It should be used alongside the original parser
 * until fully tested and validated.
 */
export function parseCaptionV2(caption: string, options?: { messageId?: string, correlationId?: string }): ParsedContent {
  const trimmedCaption = caption.trim();
  const currentTimestamp = new Date().toISOString();
  
  // Initialize parsing stages array to track what happens during parsing
  const stages: ParsingStage[] = [];
  
  // Initialize with default values
  const analyzedContent: AnalyzedContent = {
    product_name: '',
    product_code: '',
    vendor_uid: undefined,
    purchase_date: undefined,
    quantity: undefined,
    notes: '',
    parsing_metadata: {
      method: 'v2',
      timestamp: currentTimestamp,
      stages: [],
    }
  };

  // Handle empty captions
  if (!trimmedCaption) {
    return {
      ...analyzedContent,
      caption: trimmedCaption,
      parsing_metadata: {
        method: 'v2',
        timestamp: analyzedContent.parsing_metadata.timestamp,
        partial_success: true,
        missing_fields: ['product_name', 'product_code', 'vendor_uid', 'purchase_date', 'quantity'],
        stages: [
          {
            name: 'empty_check',
            success: false,
            error: 'Empty caption'
          }
        ]
      }
    } as ParsedContent;
  }

  // Track missing fields for partial success
  const missingFields: string[] = [];

  try {
    // STAGE 1: Determine caption format (multi-line vs single-line)
    const isMultiLine = trimmedCaption.includes('\n');
    stages.push({
      name: 'format_detection',
      success: true,
      match: isMultiLine ? 'multi_line' : 'single_line'
    });

    if (isMultiLine) {
      return parseMultiLineCaption(trimmedCaption, stages);
    } else {
      return parseSingleLineCaption(trimmedCaption, stages);
    }
  } catch (error) {
    console.error("Error parsing caption:", error);
    
    // Add error stage
    stages.push({
      name: 'parsing_error',
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return {
      ...analyzedContent,
      caption: trimmedCaption,
      parsing_metadata: {
        method: 'v2',
        timestamp: analyzedContent.parsing_metadata.timestamp,
        partial_success: true,
        error: error instanceof Error ? error.message : String(error),
        stages,
        missing_fields: ['parsing_error', 'product_name', 'product_code', 'vendor_uid', 'purchase_date', 'quantity']
      }
    } as ParsedContent;
  }
}

/**
 * Parse a multi-line caption (e.g. product name on first line, details on following lines)
 */
function parseMultiLineCaption(caption: string, stages: ParsingStage[]): ParsedContent {
  const lines = caption.split('\n');
  const missingFields: string[] = [];
  const currentTimestamp = new Date().toISOString();
  
  // Initialize with default values
  const analyzedContent: AnalyzedContent = {
    product_name: '',
    product_code: '',
    vendor_uid: undefined,
    purchase_date: undefined,
    quantity: undefined,
    notes: '',
    parsing_metadata: {
      method: 'v2',
      timestamp: currentTimestamp,
      stages: [],
    }
  };
  
  // STAGE 2: Extract product name from first line
  if (lines.length > 0 && lines[0].trim()) {
    analyzedContent.product_name = lines[0].trim().replace(/^['"]|['"]$/g, '');
    stages.push({
      name: 'product_name_extraction',
      success: true,
      match: analyzedContent.product_name
    });
  } else {
    missingFields.push('product_name');
    stages.push({
      name: 'product_name_extraction',
      success: false,
      error: 'No product name found in first line'
    });
  }

  // STAGE 3: Find line with product code (contains '#')
  let codeLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('#')) {
      codeLineIdx = i;
      stages.push({
        name: 'product_code_line_detection',
        success: true,
        match: `Line ${i+1}: ${lines[i]}`
      });
      break;
    }
  }

  // STAGE 4: Extract product code if found
  if (codeLineIdx >= 0) {
    const codeMatch = lines[codeLineIdx].match(/#([A-Za-z0-9-]+)/);
    if (codeMatch) {
      analyzedContent.product_code = codeMatch[1];
      stages.push({
        name: 'product_code_extraction',
        success: true,
        match: analyzedContent.product_code
      });

      // STAGE 5: Extract vendor UID from product code
      const vendorMatch = codeMatch[1].match(/^([A-Za-z]{1,4})/);
      if (vendorMatch) {
        analyzedContent.vendor_uid = vendorMatch[1].toUpperCase();
        stages.push({
          name: 'vendor_uid_extraction',
          success: true,
          match: analyzedContent.vendor_uid
        });
      } else {
        missingFields.push('vendor_uid');
        stages.push({
          name: 'vendor_uid_extraction',
          success: false,
          error: 'No vendor UID pattern found in product code'
        });
      }

      // STAGE 6: Extract purchase date from product code
      const dateMatch = codeMatch[1].match(/^[A-Za-z]{1,4}(\d{5,6})/);
      if (dateMatch) {
        const dateDigits = dateMatch[1];
        try {
          analyzedContent.purchase_date = formatPurchaseDate(dateDigits);
          stages.push({
            name: 'purchase_date_extraction',
            success: true,
            match: analyzedContent.purchase_date
          });
        } catch (e) {
          missingFields.push('purchase_date');
          stages.push({
            name: 'purchase_date_extraction',
            success: false,
            error: e instanceof Error ? e.message : String(e)
          });
        }
      } else {
        missingFields.push('purchase_date');
        stages.push({
          name: 'purchase_date_extraction',
          success: false,
          error: 'No date pattern found in product code'
        });
      }
    } else {
      missingFields.push('product_code');
      missingFields.push('vendor_uid');
      missingFields.push('purchase_date');
      stages.push({
        name: 'product_code_extraction',
        success: false,
        error: 'No product code pattern found in line'
      });
    }
  } else {
    missingFields.push('product_code');
    missingFields.push('vendor_uid');
    missingFields.push('purchase_date');
    stages.push({
      name: 'product_code_line_detection',
      success: false,
      error: 'No line with # symbol found'
    });
  }

  // STAGE 7: Gather remaining lines as notes
  if (lines.length > 1) {
    const noteLines: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      if (i !== codeLineIdx) {
        noteLines.push(lines[i].trim());
      }
    }
    analyzedContent.notes = noteLines.join('\n').trim();
    stages.push({
      name: 'notes_extraction',
      success: true,
      match: analyzedContent.notes ? 'Notes extracted' : 'No notes found'
    });
  }

  // STAGE 8: Look for quantity in notes
  if (analyzedContent.notes) {
    // First try "x12" pattern
    const qtyMatch = analyzedContent.notes.match(/(?:^|\s)x\s*(\d+)(?:\s|$)/i);
    if (qtyMatch) {
      analyzedContent.quantity = parseInt(qtyMatch[1], 10);
      analyzedContent.parsing_metadata.quantity_pattern = `x${qtyMatch[1]}`;
      analyzedContent.notes = analyzedContent.notes.replace(qtyMatch[0], ' ').trim();
      stages.push({
        name: 'quantity_extraction',
        success: true,
        match: `${analyzedContent.quantity} (pattern: x${qtyMatch[1]})`
      });
    } else {
      // Try "12x" pattern
      const altQtyMatch = analyzedContent.notes.match(/(?:^|\s)(\d+)\s*x(?:\s|$)/i);
      if (altQtyMatch) {
        analyzedContent.quantity = parseInt(altQtyMatch[1], 10);
        analyzedContent.parsing_metadata.quantity_pattern = `${altQtyMatch[1]}x`;
        analyzedContent.notes = analyzedContent.notes.replace(altQtyMatch[0], ' ').trim();
        stages.push({
          name: 'quantity_extraction',
          success: true,
          match: `${analyzedContent.quantity} (pattern: ${altQtyMatch[1]}x)`
        });
      } else {
        missingFields.push('quantity');
        stages.push({
          name: 'quantity_extraction',
          success: false,
          error: 'No quantity pattern found in notes'
        });
      }
    }
  } else {
    missingFields.push('quantity');
    stages.push({
      name: 'quantity_extraction',
      success: false,
      error: 'No notes to extract quantity from'
    });
  }

  // STAGE 9: Determine success level
  let partialSuccess = false;
  if (analyzedContent.product_name) {
    if (missingFields.length > 0) {
      partialSuccess = true;
    }
  } else {
    // Missing required product name
    partialSuccess = true;
    if (!missingFields.includes('product_name')) {
      missingFields.push('product_name');
    }
  }

  // Final result
  return {
    ...analyzedContent,
    caption,
    parsing_metadata: {
      ...analyzedContent.parsing_metadata,
      method: 'v2',
      timestamp: currentTimestamp,
      partial_success: partialSuccess,
      missing_fields: missingFields.length > 0 ? missingFields : undefined,
      stages
    }
  } as ParsedContent;
}

/**
 * Parse a single-line caption (e.g. "Product Name #CODE 12x")
 */
function parseSingleLineCaption(caption: string, stages: ParsingStage[]): ParsedContent {
  const missingFields: string[] = [];
  const currentTimestamp = new Date().toISOString();
  
  // Initialize with default values
  const analyzedContent: AnalyzedContent = {
    product_name: '',
    product_code: '',
    vendor_uid: undefined,
    purchase_date: undefined,
    quantity: undefined,
    notes: '',
    parsing_metadata: {
      method: 'v2',
      timestamp: currentTimestamp,
      stages: [],
    }
  };

  // STAGE 2: Check for simple quantity only caption "14x"
  const simpleQtyMatch = caption.match(/^(\d+)x$/);
  if (simpleQtyMatch) {
    analyzedContent.quantity = parseInt(simpleQtyMatch[1], 10);
    analyzedContent.parsing_metadata.quantity_pattern = caption;
    missingFields.push('product_name');
    missingFields.push('product_code');
    missingFields.push('vendor_uid');
    missingFields.push('purchase_date');
    
    stages.push({
      name: 'simple_quantity_extraction',
      success: true,
      match: `${analyzedContent.quantity} (full caption)`
    });
    
    return {
      ...analyzedContent,
      caption,
      parsing_metadata: {
        ...analyzedContent.parsing_metadata,
        method: 'v2',
        timestamp: currentTimestamp,
        partial_success: true,
        missing_fields: missingFields,
        stages
      }
    } as ParsedContent;
  }

  // STAGE 3: Extract product code and related information
  const productCodeMatch = caption.match(/#([A-Za-z0-9-]+)/);
  if (productCodeMatch) {
    // Extract product code
    analyzedContent.product_code = productCodeMatch[1];
    stages.push({
      name: 'product_code_extraction',
      success: true,
      match: analyzedContent.product_code
    });

    // STAGE 4: Extract product name (text before code)
    const beforeCodeText = caption.substring(0, caption.indexOf('#')).trim();
    if (beforeCodeText) {
      analyzedContent.product_name = beforeCodeText;
      stages.push({
        name: 'product_name_extraction',
        success: true,
        match: analyzedContent.product_name
      });
    } else {
      missingFields.push('product_name');
      stages.push({
        name: 'product_name_extraction',
        success: false,
        error: 'No text before product code'
      });
    }

    // STAGE 5: Extract vendor UID
    const vendorMatch = productCodeMatch[1].match(/^([A-Za-z]{1,4})/);
    if (vendorMatch) {
      analyzedContent.vendor_uid = vendorMatch[1].toUpperCase();
      stages.push({
        name: 'vendor_uid_extraction',
        success: true,
        match: analyzedContent.vendor_uid
      });
    } else {
      missingFields.push('vendor_uid');
      stages.push({
        name: 'vendor_uid_extraction',
        success: false,
        error: 'No vendor pattern found in product code'
      });
    }

    // STAGE 6: Extract purchase date
    const dateMatch = productCodeMatch[1].match(/^[A-Za-z]{1,4}(\d{5,6})/);
    if (dateMatch) {
      const dateDigits = dateMatch[1];
      try {
        analyzedContent.purchase_date = formatPurchaseDate(dateDigits);
        stages.push({
          name: 'purchase_date_extraction',
          success: true,
          match: analyzedContent.purchase_date
        });
      } catch (e) {
        missingFields.push('purchase_date');
        stages.push({
          name: 'purchase_date_extraction',
          success: false,
          error: e instanceof Error ? e.message : String(e)
        });
      }
    } else {
      missingFields.push('purchase_date');
      stages.push({
        name: 'purchase_date_extraction',
        success: false,
        error: 'No date pattern found in product code'
      });
    }

    // STAGE 7: Extract quantity
    const qtyMatch = caption.match(/x\s*(\d+)/i);
    if (qtyMatch) {
      analyzedContent.quantity = parseInt(qtyMatch[1], 10);
      analyzedContent.parsing_metadata.quantity_pattern = `x${qtyMatch[1]}`;
      stages.push({
        name: 'quantity_extraction',
        success: true,
        match: `${analyzedContent.quantity} (pattern: x${qtyMatch[1]})`
      });
    } else {
      const altQtyMatch = caption.match(/(\d+)\s*x/i);
      if (altQtyMatch) {
        analyzedContent.quantity = parseInt(altQtyMatch[1], 10);
        analyzedContent.parsing_metadata.quantity_pattern = `${altQtyMatch[1]}x`;
        stages.push({
          name: 'quantity_extraction',
          success: true,
          match: `${analyzedContent.quantity} (pattern: ${altQtyMatch[1]}x)`
        });
      } else {
        missingFields.push('quantity');
        stages.push({
          name: 'quantity_extraction',
          success: false,
          error: 'No quantity pattern found'
        });
      }
    }

    // STAGE 8: Extract notes (content in parentheses)
    const notesMatch = caption.match(/\(([^)]+)\)/);
    if (notesMatch) {
      analyzedContent.notes = notesMatch[1].trim();
      stages.push({
        name: 'notes_extraction',
        success: true,
        match: analyzedContent.notes
      });
    } else {
      // Use text after product code and quantity as notes
      const afterCodeText = caption.substring(
        caption.indexOf('#') + productCodeMatch[0].length
      ).trim();

      if (afterCodeText) {
        // Remove quantity pattern if present
        let notes = afterCodeText;
        if (analyzedContent.parsing_metadata.quantity_pattern) {
          notes = notes.replace(analyzedContent.parsing_metadata.quantity_pattern, '').trim();
        }
        if (notes) {
          analyzedContent.notes = notes;
          stages.push({
            name: 'notes_extraction',
            success: true,
            match: analyzedContent.notes
          });
        }
      }
    }
  } else {
    // No product code found
    analyzedContent.product_name = caption;
    missingFields.push('product_code');
    missingFields.push('vendor_uid');
    missingFields.push('purchase_date');
    missingFields.push('quantity');
    
    stages.push({
      name: 'product_name_extraction',
      success: true,
      match: analyzedContent.product_name
    });
    
    stages.push({
      name: 'product_code_extraction', 
      success: false,
      error: 'No product code pattern found'
    });
  }

  // STAGE 9: Determine success level
  let partialSuccess = false;
  if (analyzedContent.product_name) {
    if (missingFields.length > 0) {
      partialSuccess = true;
    }
  } else {
    // Missing required product name
    partialSuccess = true;
    if (!missingFields.includes('product_name')) {
      missingFields.push('product_name');
    }
  }

  // Final result
  return {
    ...analyzedContent,
    caption,
    parsing_metadata: {
      ...analyzedContent.parsing_metadata,
      method: 'v2',
      timestamp: currentTimestamp,
      partial_success: partialSuccess,
      missing_fields: missingFields.length > 0 ? missingFields : undefined,
      stages
    }
  } as ParsedContent;
}

/**
 * Format purchase date from digits to YYYY-MM-DD
 */
function formatPurchaseDate(dateDigits: string): string {
  // Add leading zero for 5-digit dates
  const normalizedDigits = dateDigits.length === 5 ? `0${dateDigits}` : dateDigits;

  if (normalizedDigits.length !== 6) {
    throw new Error(`Invalid date format: ${dateDigits}`);
  }

  // Format is mmDDyy
  const month = normalizedDigits.substring(0, 2);
  const day = normalizedDigits.substring(2, 4);
  const year = normalizedDigits.substring(4, 6);

  // Convert to YYYY-MM-DD
  const fullYear = `20${year}`; // Assuming 20xx year

  // Validate date
  const dateObj = new Date(`${fullYear}-${month}-${day}`);
  if (isNaN(dateObj.getTime())) {
    throw new Error(`Invalid date: ${month}/${day}/${fullYear}`);
  }

  return `${fullYear}-${month}-${day}`;
}
