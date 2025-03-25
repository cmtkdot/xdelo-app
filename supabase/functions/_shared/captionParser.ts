
/**
 * Caption Parser
 * Extracts structured product information from message captions
 */

// Regular expressions for pattern matching
const PRODUCT_CODE_REGEX = /(?:^|\s|#)([A-Z]{1,3}-\d{3,6}(?:-[A-Z0-9]+)?)(?:\s|$|,|\.)/g;
const CURRENCY_SYMBOL_REGEX = /[$€£¥₽₴₸₮₩₺₼₾]/;
const PRICE_REGEX = /(?:^|\s)((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{1,2})?)(?:\s*(?:usd|eur|gbp|USD|EUR|GBP|$|€|£))?(?:\s|$|,|\.|;)/;
const VENDOR_HASHTAG_REGEX = /#([a-zA-Z0-9_]+)/g;

// Deno doesn't have URLPattern built-in, so we use a simplified regex for URLs
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

// Product information extraction
export interface ParsedContent {
  product_code?: string | null;
  product_codes?: string[];
  price?: number | null;
  currency?: string | null;
  vendors?: string[];
  hashtags?: string[];
  urls?: string[];
  parsed_with?: string;
  parsing_metadata?: Record<string, any>;
  [key: string]: any;
}

/**
 * Main caption parsing function
 * @param caption Raw caption text from the message
 * @returns Structured product information
 */
export function xdelo_parseCaption(caption: string): ParsedContent {
  if (!caption || typeof caption !== 'string') {
    return { parsed_with: 'manual', error: 'No valid caption provided' };
  }

  const result: ParsedContent = {
    parsed_with: 'manual',
    product_codes: [],
    vendors: [],
    hashtags: []
  };

  try {
    // Extract product codes using regex
    const productCodes = [];
    let match;
    while ((match = PRODUCT_CODE_REGEX.exec(caption)) !== null) {
      productCodes.push(match[1]);
    }
    
    if (productCodes.length > 0) {
      result.product_codes = [...new Set(productCodes)]; // Remove duplicates
      result.product_code = productCodes[0]; // First product code for backward compatibility
    }

    // Extract price information
    const priceMatch = caption.match(PRICE_REGEX);
    if (priceMatch) {
      const priceValue = priceMatch[1].replace(',', '');
      result.price = parseFloat(priceValue);
      
      // Determine currency if present
      const currencyMatch = caption.match(CURRENCY_SYMBOL_REGEX);
      if (currencyMatch) {
        result.currency = currencyMatch[0];
      } else if (caption.includes('usd') || caption.includes('USD') || caption.includes('$')) {
        result.currency = '$';
      } else if (caption.includes('eur') || caption.includes('EUR') || caption.includes('€')) {
        result.currency = '€';
      } else if (caption.includes('gbp') || caption.includes('GBP') || caption.includes('£')) {
        result.currency = '£';
      }
    }

    // Extract hashtags for vendor information
    const hashtags: string[] = [];
    const vendors: string[] = [];
    
    while ((match = VENDOR_HASHTAG_REGEX.exec(caption)) !== null) {
      const tag = match[1];
      hashtags.push(tag);
      
      // Certain hashtags might be vendor identifiers
      if (tag.length > 2 && !tag.match(/^\d+$/)) {
        vendors.push(tag);
      }
    }
    
    if (hashtags.length > 0) {
      result.hashtags = [...new Set(hashtags)]; // Remove duplicates
    }
    
    if (vendors.length > 0) {
      result.vendors = [...new Set(vendors)]; // Remove duplicates
    }

    // Extract URLs
    const urls: string[] = [];
    while ((match = URL_REGEX.exec(caption)) !== null) {
      urls.push(match[1]);
    }
    
    if (urls.length > 0) {
      result.urls = urls;
    }

    return result;
  } catch (error) {
    console.error(`Error parsing caption: ${error.message}`);
    return {
      parsed_with: 'manual',
      error: `Parsing error: ${error.message}`,
      partial_result: result
    };
  }
}

/**
 * Clean and normalize a product code
 * @param code Raw product code string
 * @returns Normalized product code
 */
export function normalizeProductCode(code: string): string {
  if (!code) return '';
  
  // Remove any surrounding whitespace, hashtags, or punctuation
  let cleaned = code.trim().replace(/^#/, '');
  
  // Ensure proper format (e.g., ABC-12345)
  const parts = cleaned.split('-');
  if (parts.length >= 2) {
    // If format is like ABC-12345, normalize it
    const prefix = parts[0].toUpperCase();
    const numbers = parts[1];
    
    if (/^[A-Z]{1,3}$/.test(prefix) && /^\d+$/.test(numbers)) {
      return `${prefix}-${numbers}${parts.length > 2 ? '-' + parts.slice(2).join('-') : ''}`;
    }
  }
  
  return cleaned;
}
