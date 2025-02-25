
import { GlProduct, ProductMatch } from './types.ts';

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  const longerLength = longer.length;

  if (longerLength === 0) return 1.0;

  const distance = levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
  return (longerLength - distance) / longerLength;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str1.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str1.length][str2.length];
}

export function findBestProductMatch(
  products: GlProduct[],
  productName: string,
  vendorName?: string,
  poNumber?: string,
  vendorUid?: string,
  purchaseDate?: string,
  minConfidence = 0.6
): { matches: ProductMatch[]; bestMatch: ProductMatch | null } {
  const matches: ProductMatch[] = [];

  for (const product of products) {
    let confidenceScore = 0;
    const matchDetails: string[] = [];

    // Match product name
    if (productName && product.main_product_name) {
      const similarity = calculateStringSimilarity(productName, product.main_product_name);
      confidenceScore += similarity * 0.4;
      if (similarity > 0.7) {
        matchDetails.push('Product name match');
      }
    }

    // Match vendor UID
    if (vendorUid && product.main_vendor_uid) {
      if (vendorUid.toLowerCase() === product.main_vendor_uid.toLowerCase()) {
        confidenceScore += 0.3;
        matchDetails.push('Vendor UID match');
      }
    }

    // Match purchase date
    if (purchaseDate && product.main_product_purchase_date) {
      if (new Date(purchaseDate).toDateString() === new Date(product.main_product_purchase_date).toDateString()) {
        confidenceScore += 0.3;
        matchDetails.push('Purchase date match');
      }
    }

    if (confidenceScore >= minConfidence) {
      matches.push({
        product_id: product.id,
        glide_id: product.glide_id || null,
        confidence_score: confidenceScore,
        match_priority: Math.floor((1 - confidenceScore) * 4) + 1,
        match_details: matchDetails.join(', '),
        match_criteria: {
          name_match: matchDetails.includes('Product name match'),
          vendor_match: matchDetails.includes('Vendor UID match'),
          date_match: matchDetails.includes('Purchase date match')
        }
      });
    }
  }

  // Sort matches by confidence score (descending)
  matches.sort((a, b) => b.confidence_score - a.confidence_score);

  return {
    matches,
    bestMatch: matches.length > 0 ? matches[0] : null
  };
}
