/**
 * Parse caption text to extract product information
 * @param caption The caption text to parse
 * @param options Optional configuration
 * @returns Parsed content object
 */ export function xdelo_parseCaption(caption, options = {}) {
  const currentTimestamp = new Date().toISOString();
  if (!caption) {
    return {
      product_name: "",
      parsing_metadata: {
        method: "manual",
        timestamp: currentTimestamp,
        partial_success: true,
        missing_fields: [
          "caption"
        ]
      }
    };
  }
  const trimmedCaption = caption.trim();
  // Initialize with default values
  const parsedContent = {
    product_name: "",
    product_code: "",
    vendor_uid: null,
    purchase_date: null,
    quantity: null,
    notes: "",
    caption: trimmedCaption,
    raw_text: trimmedCaption,
    raw_lines: trimmedCaption.split("\n").map((line)=>line.trim()).filter(Boolean),
    parsing_metadata: {
      method: "manual",
      timestamp: currentTimestamp,
      partial_success: false,
      missing_fields: []
    }
  };
  try {
    // Track missing fields for partial success
    const missingFields = [];
    // Extract product name (text before '#')
    const productNameMatch = trimmedCaption.match(/^(.*?)(?=#|\n|$)/);
    if (productNameMatch && productNameMatch[1].trim()) {
      parsedContent.product_name = productNameMatch[1].trim();
    } else {
      // Fallback: Use the full trimmed caption as the product name
      parsedContent.product_name = trimmedCaption;
      missingFields.push("product_name"); // Still note that specific extraction failed
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
        missingFields.push("vendor_uid");
      }
      // Extract purchase date (digits after vendor letters)
      const dateMatch = productCodeMatch[1].match(/^[A-Za-z]{1,4}(\d{5,6})/);
      if (dateMatch) {
        const dateDigits = dateMatch[1];
        try {
          parsedContent.purchase_date = formatPurchaseDate(dateDigits);
        } catch (dateError) {
          console.log("Date parsing error:", dateError);
          missingFields.push("purchase_date");
        }
      } else {
        missingFields.push("purchase_date");
      }
    } else {
      missingFields.push("product_code", "vendor_uid", "purchase_date");
    }
    // Extract quantity (number following 'x')
    const quantityMatch = trimmedCaption.match(/x\s*(\d+)/i);
    if (quantityMatch) {
      parsedContent.quantity = parseInt(quantityMatch[1], 10);
      parsedContent.parsing_metadata.quantity_pattern = `x${quantityMatch[1]}`;
    } else {
      // Try alternative quantity patterns
      const altQuantityMatch = trimmedCaption.match(/(?:qty|quantity):\s*(\d+)/i) || trimmedCaption.match(/(\d+)\s*(?:pcs|pieces|units)/i);
      if (altQuantityMatch) {
        parsedContent.quantity = parseInt(altQuantityMatch[1], 10);
        parsedContent.parsing_metadata.quantity_pattern = altQuantityMatch[0];
      } else {
        missingFields.push("quantity");
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
          notes = notes.replace(parsedContent.parsing_metadata.quantity_pattern, "").trim();
        }
        parsedContent.notes = notes;
      }
    }
    // Check if we have at least a product name - this means partial success
    if (parsedContent.product_name) {
      parsedContent.parsing_metadata.partial_success = missingFields.length > 0;
      parsedContent.parsing_metadata.missing_fields = missingFields.length > 0 ? missingFields : undefined;
    }
    return parsedContent;
  } catch (error) {
    console.error("Error parsing caption:", error);
    if (error instanceof Error) {
      parsedContent.parsing_metadata.error = error.message;
    } else {
      parsedContent.parsing_metadata.error = String(error);
    }
    return parsedContent;
  }
}
/**
 * Process caption text to extract product information
 * This is an adapter function for backward compatibility
 *
 * @param caption The caption text to parse
 * @param options Optional configuration
 * @returns Parsed content object
 */ export function processCaptionText(caption, options = {}) {
  return xdelo_parseCaption(caption, options);
}
function formatPurchaseDate(dateDigits) {
  // Add leading zero for 5-digit dates (missing leading zero in month)
  const normalizedDigits = dateDigits.length === 5 ? "0" + dateDigits : dateDigits;
  if (normalizedDigits.length !== 6) {
    throw new Error(`Invalid date format: ${dateDigits}`);
  }
  // Format is mmDDyy
  const month = normalizedDigits.substring(0, 2);
  const day = normalizedDigits.substring(2, 4);
  const year = normalizedDigits.substring(4, 6);
  // Convert to YYYY-MM-DD
  const fullYear = "20" + year; // Assuming 20xx year
  // Validate date
  const dateObj = new Date(`${fullYear}-${month}-${day}`);
  if (isNaN(dateObj.getTime())) {
    throw new Error(`Invalid date: ${month}/${day}/${fullYear}`);
  }
  return `${fullYear}-${month}-${day}`;
}
