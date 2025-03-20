
import { MatchResult } from '@/types/utils/MatchResult';

// Function to calculate string similarity using Levenshtein distance
function stringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  // Calculate Levenshtein distance
  const track = Array(s2.length + 1).fill(null).map(() => 
    Array(s1.length + 1).fill(null));
  
  for (let i = 0; i <= s1.length; i += 1) {
    track[0][i] = i;
  }
  
  for (let j = 0; j <= s2.length; j += 1) {
    track[j][0] = j;
  }
  
  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator, // substitution
      );
    }
  }
  
  const distance = track[s2.length][s1.length];
  const maxLength = Math.max(s1.length, s2.length);
  
  // Return similarity ratio (1 - normalized distance)
  return maxLength > 0 ? 1 - distance / maxLength : 1;
}

// Function to find product matches
export function findProductMatches(
  products: any[],
  productName: string,
  vendorName?: string,
  poNumber?: string,
  vendorUid?: string,
  minConfidence: number = 0.6
): MatchResult[] {
  if (!productName || !products || products.length === 0) {
    return [];
  }
  
  // Preprocess input for better matching
  const normalizedInput = productName.toLowerCase().trim();
  
  const matches: MatchResult[] = [];
  
  for (const product of products) {
    // Calculate similarity for product name
    const nameSimilarity = stringSimilarity(normalizedInput, product.product_name || '');
    
    // Additional matching factors
    let vendorMatch = 0;
    if (vendorName && product.vendor_name) {
      vendorMatch = stringSimilarity(vendorName, product.vendor_name) * 0.2;
    }
    
    let vendorUidMatch = 0;
    if (vendorUid && product.vendor_uid) {
      vendorUidMatch = stringSimilarity(vendorUid, product.vendor_uid) * 0.3;
    }
    
    let poMatch = 0;
    if (poNumber && product.po_number) {
      poMatch = stringSimilarity(poNumber, product.po_number) * 0.2;
    }
    
    // Calculate final confidence score
    const confidenceScore = nameSimilarity * 0.6 + vendorMatch + vendorUidMatch + poMatch;
    
    if (confidenceScore >= minConfidence) {
      matches.push({
        product_name: product.product_name || 'Unknown',
        product_id: product.id || product.product_id,
        confidence_score: confidenceScore,
        match_details: `Name similarity: ${(nameSimilarity * 100).toFixed(0)}%${
          vendorMatch ? `, Vendor match: ${(vendorMatch * 100 / 0.2).toFixed(0)}%` : ''
        }${
          vendorUidMatch ? `, Vendor ID match: ${(vendorUidMatch * 100 / 0.3).toFixed(0)}%` : ''
        }`,
        vendor_uid: product.vendor_uid,
        product_code: product.product_code,
        glide_id: product.rowid,
        match_priority: confidenceScore >= 0.8 ? 'high' : confidenceScore >= 0.7 ? 'medium' : 'low'
      });
    }
  }
  
  // Sort by confidence score descending
  return matches.sort((a, b) => b.confidence_score - a.confidence_score);
}

// Function to find the best match
export function findBestMatch(matches: MatchResult[]): MatchResult | null {
  if (!matches || matches.length === 0) {
    return null;
  }
  
  return matches[0];
}

// Wrapper function to support legacy code
export const matchProduct = findProductMatches;
export const updateProduct = (product: any, updates: any) => {
  return {...product, ...updates};
};
export const findMatches = findProductMatches;
