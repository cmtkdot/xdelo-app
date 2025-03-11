
import { ParsedContent } from "./types.ts";

// Simple manual caption parser implementation
export function parseCaption(caption: string): ParsedContent {
  if (!caption) {
    return {
      parsing_metadata: {
        method: 'manual',
        timestamp: new Date().toISOString(),
        error: 'Empty caption'
      }
    };
  }

  // Default parsed content structure
  const parsedContent: ParsedContent = {
    parsing_metadata: {
      method: 'manual',
      timestamp: new Date().toISOString()
    }
  };

  try {
    // Extract product name (usually the first line or until a delimiter)
    const lines = caption.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 0) {
      parsedContent.product_name = lines[0].trim();
    }

    // Look for vendor information (often prefixed with "from" or contains vendor indicators)
    const vendorRegex = /(?:from|by|vendor|supplier|seller):\s*([^,\n]+)/i;
    const vendorMatch = caption.match(vendorRegex);
    if (vendorMatch && vendorMatch[1]) {
      parsedContent.vendor_uid = vendorMatch[1].trim();
    }

    // Look for product code (often prefixed with "code", "sku", "id")
    const codeRegex = /(?:code|sku|id|ref|reference|product code)[\s:]*([a-z0-9-]+)/i;
    const codeMatch = caption.match(codeRegex);
    if (codeMatch && codeMatch[1]) {
      parsedContent.product_code = codeMatch[1].trim();
    }

    // Try to extract purchase date
    const dateRegex = /(?:date|purchased|bought|ordered)(?:\s+on)?[\s:]*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2})/i;
    const dateMatch = caption.match(dateRegex);
    if (dateMatch && dateMatch[1]) {
      // Store the raw matched date string, it will be normalized elsewhere if needed
      parsedContent.purchase_date = dateMatch[1].trim();
    }

    // Look for quantity information
    const qtyRegex = /(?:qty|quantity|count)[\s:]*(\d+)/i;
    const qtyMatch = caption.match(qtyRegex);
    if (qtyMatch && qtyMatch[1]) {
      parsedContent.quantity = parseInt(qtyMatch[1], 10);
      // Store the pattern that was used to extract quantity
      parsedContent.parsing_metadata.quantity_pattern = qtyMatch[0];
    } else {
      // Try a more general number pattern if specific patterns fail
      const numRegex = /(\d+)\s*(?:pcs|pieces|units|items)/i;
      const numMatch = caption.match(numRegex);
      if (numMatch && numMatch[1]) {
        parsedContent.quantity = parseInt(numMatch[1], 10);
        parsedContent.parsing_metadata.quantity_pattern = numMatch[0];
      }
    }

    // Store original caption for reference
    parsedContent.caption = caption;

    // Add any remaining text as notes
    if (lines.length > 1) {
      const restOfText = lines.slice(1).join('\n').trim();
      if (restOfText.length > 0) {
        parsedContent.notes = restOfText;
      }
    }

    return parsedContent;
  } catch (error) {
    console.error('Error parsing caption:', error);
    return {
      caption,
      parsing_metadata: {
        method: 'manual',
        timestamp: new Date().toISOString(),
        error: error.message,
        used_fallback: true,
        original_caption: caption
      }
    };
  }
}
