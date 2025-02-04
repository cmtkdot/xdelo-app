import { QuantityParseResult } from "../types.ts";

export function parseQuantity(caption: string): QuantityParseResult | null {
  // Look for patterns like "x2", "x 2", "qty: 2", "quantity: 2"
  const patterns = [
    /x\s*(\d+)/i,                    // x2 or x 2
    /qty:\s*(\d+)/i,                 // qty: 2
    /quantity:\s*(\d+)/i,            // quantity: 2
    /(\d+)\s*(?:pcs|pieces)/i,       // 2 pcs or 2 pieces
    /(\d+)\s*(?:units?)/i,           // 2 unit or 2 units
    /(\d+)\s*(?=\s|$)/               // standalone number
  ];

  for (const pattern of patterns) {
    const match = caption.match(pattern);
    if (match) {
      const value = parseInt(match[1], 10);
      if (value > 0 && value < 10000) { // Reasonable quantity range
        return {
          value,
          confidence: 0.9 // High confidence for explicit patterns
        };
      }
    }
  }

  return null;
}