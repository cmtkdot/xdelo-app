
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
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
  const m = str1.length;
  const n = str2.length;
  
  // Create a matrix of size (m+1) x (n+1)
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  // Fill first column and first row
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  // Fill the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,        // deletion
        dp[i][j - 1] + 1,        // insertion
        dp[i - 1][j - 1] + cost  // substitution
      );
    }
  }
  
  return dp[m][n];
}

/**
 * Calculate Jaro similarity between two strings
 */
function jaroSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1.0;
  
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  const s1Len = s1.length;
  const s2Len = s2.length;
  
  // Calculate matching distance
  const matchDistance = Math.floor(Math.max(s1Len, s2Len) / 2) - 1;
  
  // Check for matches and transpositions
  const s1Matches = new Array(s1Len).fill(false);
  const s2Matches = new Array(s2Len).fill(false);
  
  let matches = 0;
  
  // Find all matches
  for (let i = 0; i < s1Len; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, s2Len);
    
    for (let j = start; j < end; j++) {
      if (!s2Matches[j] && s1[i] === s2[j]) {
        s1Matches[i] = true;
        s2Matches[j] = true;
        matches++;
        break;
      }
    }
  }
  
  if (matches === 0) return 0;
  
  // Count transpositions
  let transpositions = 0;
  let k = 0;
  
  for (let i = 0; i < s1Len; i++) {
    if (s1Matches[i]) {
      while (!s2Matches[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }
  }
  
  // Jaro similarity formula
  return (
    matches / s1Len +
    matches / s2Len +
    (matches - transpositions / 2) / matches
  ) / 3.0;
}

/**
 * Find best product match for a given message
 */
export function findBestProductMatch(
  products: GlProduct[],
  productName: string,
  vendorName: string,
  poNumber: string,
  vendorUid: string,
  purchaseDate: string,
  minConfidence: number = 0.6
): { matches: ProductMatch[]; bestMatch: ProductMatch | null } {
  const matches: ProductMatch[] = [];
  
  if (!products || !products.length) {
    return { matches: [], bestMatch: null };
  }
  
  // Process each product for potential matches
  for (const product of products) {
    let confidenceScore = 0;
    let matchPriority = 0;
    
    // Name similarity matching
    let nameMatchScore = 0;
    if (productName && product.main_product_name) {
      nameMatchScore = calculateStringSimilarity(productName, product.main_product_name);
    }
    
    // Vendor matching
    let vendorMatch = false;
    if (vendorUid && product.main_vendor_uid) {
      if (vendorUid === product.main_vendor_uid) {
        vendorMatch = true;
      }
    }
    
    // Date matching
    let dateMatch = false;
    if (purchaseDate && product.main_product_purchase_date) {
      if (purchaseDate === product.main_product_purchase_date) {
        dateMatch = true;
      }
    }
    
    // Calculate overall confidence
    confidenceScore = (
      (nameMatchScore * 0.6) + 
      (vendorMatch ? 0.3 : 0) +
      (dateMatch ? 0.1 : 0)
    );
    
    // Only include matches that meet the minimum confidence threshold
    if (confidenceScore >= minConfidence) {
      matches.push({
        product_id: product.id,
        glide_id: product.glide_id,
        confidence_score: confidenceScore,
        match_priority: matchPriority,
        match_details: JSON.stringify({
          name_match_score: nameMatchScore,
          vendor_match: vendorMatch,
          date_match: dateMatch
        }),
        match_criteria: {
          name_match: nameMatchScore > 0.7,
          vendor_match: vendorMatch,
          date_match: dateMatch
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
