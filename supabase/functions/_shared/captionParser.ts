
/**
 * Parse a message caption to extract structured data
 * This is a shared utility used by multiple edge functions
 */
export function xdelo_parseCaption(caption: string) {
  if (!caption) {
    return { parsing_success: false, error: "No caption provided" };
  }

  // Initialize result object with defaults
  const result: any = {
    parsing_success: true,
    parsing_method: "rule-based",
    product_name: null,
    vendor_uid: null,
    purchase_date: null,
    quantity: null,
    price: null,
    notes: null,
    tags: [],
    raw_caption: caption.trim(),
  };

  try {
    // Extract product name (first line or portion before first special marker)
    const firstLine = caption.split('\n')[0].trim();
    if (firstLine) {
      result.product_name = firstLine;
    }

    // Look for common data patterns
    
    // Vendor ID pattern: VID: XXXXX or Vendor: XXXXX or #XXXXX
    const vendorMatch = caption.match(/(?:VID|Vendor|V|vendor)[\s:]*([A-Za-z0-9_-]+)/i) || 
                       caption.match(/#([A-Za-z0-9_-]+)/);
    if (vendorMatch) {
      result.vendor_uid = vendorMatch[1];
    }

    // Date pattern: common date formats
    const dateMatch = caption.match(/(?:Date|Purchased|PD)[\s:]*(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4})/i) ||
                     caption.match(/(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/);
    if (dateMatch) {
      // Try to parse the date
      try {
        const dateParts = dateMatch[1].split(/[-/.]/);
        // Assume MM/DD/YYYY or DD/MM/YYYY based on locale
        // For simplicity, we'll use YYYY-MM-DD format for storage
        let year, month, day;
        
        // If the first part is a 4-digit number, assume YYYY-MM-DD
        if (dateParts[0].length === 4) {
          [year, month, day] = dateParts;
        } 
        // If the last part is a 4-digit number, assume MM/DD/YYYY or DD/MM/YYYY
        else if (dateParts[2] && dateParts[2].length === 4) {
          year = dateParts[2];
          month = dateParts[0];
          day = dateParts[1];
        } 
        // Handle 2-digit years
        else if (dateParts[2] && dateParts[2].length === 2) {
          year = `20${dateParts[2]}`; // Assume 20xx for simplicity
          month = dateParts[0];
          day = dateParts[1];
        }
        
        if (year && month && day) {
          // Validate the date
          const dateObj = new Date(`${year}-${month}-${day}`);
          if (!isNaN(dateObj.getTime())) {
            result.purchase_date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
        }
      } catch (e) {
        console.error("Error parsing date:", e);
      }
    }

    // Quantity pattern: Qty: X or Quantity: X
    const qtyMatch = caption.match(/(?:Qty|Quantity|Q)[\s:]*(\d+)/i);
    if (qtyMatch) {
      result.quantity = parseInt(qtyMatch[1], 10);
    }

    // Price pattern: $X.XX or X.XX USD or Price: X.XX
    const priceMatch = caption.match(/\$(\d+(?:\.\d+)?)/i) || 
                      caption.match(/(\d+(?:\.\d+)?)\s*(?:USD|EUR|GBP)/i) ||
                      caption.match(/(?:Price|Cost)[\s:]*\$?(\d+(?:\.\d+)?)/i);
    if (priceMatch) {
      result.price = parseFloat(priceMatch[1]);
    }

    // Notes pattern: Notes: XXXXX or Note: XXXXX (to end of caption)
    const notesMatch = caption.match(/(?:Notes|Note)[\s:](.*?)(?:$|\n)/i);
    if (notesMatch) {
      result.notes = notesMatch[1].trim();
    }

    // Extract hashtags as tags
    const hashTags = caption.match(/#[a-zA-Z0-9_]+/g);
    if (hashTags) {
      result.tags = hashTags.map(tag => tag.substring(1)); // Remove # prefix
    }

  } catch (error) {
    console.error("Error parsing caption:", error);
    result.parsing_success = false;
    result.error = `Parsing error: ${error.message}`;
  }

  return result;
}
