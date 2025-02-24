import { MatchResult } from "@/types";

const similarityThreshold = 0.7;

function stringSimilarity(str1: string, str2: string): number {
  str1 = str1.toLowerCase();
  str2 = str2.toLowerCase();

  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) {
    return 1; // both strings are empty
  }

  let matches = 0;
  for (let i = 0; i < str1.length; i++) {
    if (str2.includes(str1[i])) {
      matches++;
    }
  }

  return matches / maxLength;
}

export function calculateMatchConfidence(message: any, product: any): MatchResult {
  const matchedFields: string[] = [];
  let overallConfidence = 0;

  if (message.product_name && product.main_product_name) {
    const nameSimilarity = stringSimilarity(message.product_name, product.main_product_name);
    if (nameSimilarity > similarityThreshold) {
      overallConfidence += nameSimilarity * 0.4;
      matchedFields.push('product_name');
    }
  }

  if (message.vendor_uid && product.main_vendor_uid) {
    if (message.vendor_uid === product.main_vendor_uid) {
      overallConfidence += 0.3;
      matchedFields.push('vendor_uid');
    }
  }

  if (message.purchase_date && product.main_product_purchase_date) {
    if (message.purchase_date === product.main_product_purchase_date) {
      overallConfidence += 0.3;
      matchedFields.push('purchase_date');
    }
  }

  return {
    id: Math.random().toString(),
    message_id: message.id,
    product_id: product.id,
    confidence: overallConfidence,
    matchType: 'automatic',
    match_confidence: overallConfidence,
    details: {
      matchedFields,
      confidence: overallConfidence
    }
  };
}

export function findMatchingProducts(message: any, products: any[]): MatchResult[] {
  const matches: MatchResult[] = [];

  for (const product of products) {
    const match = calculateMatchConfidence(message, product);
    if (match.confidence > similarityThreshold) {
      matches.push(match);
    }
  }

  return matches;
}
