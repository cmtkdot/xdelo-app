import { QuantityParseResult } from './types.ts';

const QUANTITY_PATTERNS = {
  STANDARD_X: /[x×]\s*(\d+)/i,
  WITH_UNITS: /(\d+)\s*(pc|pcs|pieces?|units?|qty)/i,
  PREFIX_QTY: /(?:qty|quantity)\s*:?\s*(\d+)/i,
  PARENTHESES: /\((?:qty|quantity|x|×)?\s*(\d+)\s*(?:pc|pcs|pieces?)?\)/i,
  NUMBER_PREFIX: /^(\d+)\s*[x×]/i,
  TEXT_NUMBERS: /\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/i,
  APPROXIMATE: /(?:about|approximately|approx|~)\s*(\d+)/i
};

const TEXT_TO_NUMBER: { [key: string]: number } = {
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
};

const UNIT_NORMALIZATIONS: { [key: string]: string } = {
  'pc': 'piece',
  'pcs': 'pieces',
  'piece': 'piece',
  'pieces': 'pieces',
  'unit': 'unit',
  'units': 'units',
  'qty': 'quantity'
};

function validateQuantity(value: number): number | null {
  if (isNaN(value) || value <= 0 || value > 9999) return null;
  return value;
}

export function parseQuantity(text: string): QuantityParseResult | null {
  console.log("Parsing quantity from:", text);

  const patterns: [RegExp, string, number][] = [
    [QUANTITY_PATTERNS.STANDARD_X, 'explicit', 0.9],
    [QUANTITY_PATTERNS.WITH_UNITS, 'explicit', 0.9],
    [QUANTITY_PATTERNS.PREFIX_QTY, 'explicit', 0.85],
    [QUANTITY_PATTERNS.PARENTHESES, 'explicit', 0.8],
    [QUANTITY_PATTERNS.NUMBER_PREFIX, 'explicit', 0.8],
    [QUANTITY_PATTERNS.APPROXIMATE, 'explicit', 0.7],
    [QUANTITY_PATTERNS.TEXT_NUMBERS, 'text', 0.6]
  ];

  for (const [pattern, method, confidence] of patterns) {
    const match = text.match(pattern);
    if (match) {
      let value: number;
      let is_approximate = false;

      if (method === 'text') {
        value = TEXT_TO_NUMBER[match[1].toLowerCase()];
      } else {
        value = parseInt(match[1]);
        is_approximate = text.includes('~') || 
                        text.toLowerCase().includes('about') || 
                        text.toLowerCase().includes('approx');
      }

      const validatedValue = validateQuantity(value);
      if (validatedValue === null) continue;

      let unit: string | undefined;
      const unitMatch = text.match(/(?:pc|pcs|pieces?|units?)/i);
      if (unitMatch) {
        unit = UNIT_NORMALIZATIONS[unitMatch[0].toLowerCase()];
      }

      return {
        value: validatedValue,
        confidence: is_approximate ? confidence * 0.8 : confidence,
        unit,
        original_text: match[0],
        method: method as 'explicit' | 'numeric' | 'text' | 'fallback',
        is_approximate
      };
    }
  }

  const numberMatch = text.match(/\b(\d+)\b/);
  if (numberMatch) {
    const value = validateQuantity(parseInt(numberMatch[1]));
    if (value !== null) {
      return {
        value,
        confidence: 0.4,
        original_text: numberMatch[0],
        method: 'fallback',
        is_approximate: false
      };
    }
  }

  return null;
}