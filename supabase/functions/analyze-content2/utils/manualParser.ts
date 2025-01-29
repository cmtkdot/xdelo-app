import { AnalyzedContent } from "../types.ts";
import { parsePurchaseDate } from "./dateParser.ts";

export function parseManually(text: string): AnalyzedContent {
  console.log("Falling back to manual parsing for:", text);

  const result: AnalyzedContent = {};

  // Extract product code and vendor_uid
  const codeMatch = text.match(/#([A-Z]+)(\d+)/);
  if (codeMatch) {
    result.product_code = codeMatch[0];
    result.vendor_uid = codeMatch[1];
    
    // Parse date from code
    const dateStr = codeMatch[2];
    result.purchase_date = parsePurchaseDate(dateStr);
  }

  // Extract quantity
  const quantityMatch = text.match(/x\s*(\d+)/i);
  if (quantityMatch) {
    result.quantity = parseInt(quantityMatch[1]);
  }

  // Extract notes (text in parentheses)
  const notesMatch = text.match(/\((.*?)\)/);
  if (notesMatch) {
    result.notes = notesMatch[1].trim();
  }

  // Extract product name (everything before the product code)
  const productNameMatch = text.split("#")[0];
  if (productNameMatch) {
    result.product_name = productNameMatch.trim();
  }

  return result;
}