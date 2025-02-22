import { GlProduct, ProductMatch, NAME_MATCH_WEIGHTS, PRIORITY_LEVELS } from './types.ts';

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateStringSimilarity(str1: string, str2: string): number {
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

/**
 * Calculate match score for a product
 */
export function calculateProductMatch(
  searchName: string,
  candidate: GlProduct,
  vendorName?: string,
  poNumber?: string,
  vendorUid?: string,
  purchaseDate?: string
): ProductMatch {
  let confidence_score = 0;
  let match_priority = 4; // Start with lowest priority
  const matchDetails: string[] = [];
  const match_criteria = {
    name_match: false,
    vendor_match: false,
    po_match: false,
    date_match: false
  };

  // Normalize strings for comparison
  const normalizedSearch = searchName.toLowerCase().trim();
  const normalizedProductName = candidate.main_product_name?.toLowerCase().trim() || '';
  const normalizedVendorProductName = candidate.main_vendor_product_name?.toLowerCase().trim() || '';
  const normalizedVendorUid = candidate.main_vendor_uid?.toLowerCase().trim() || '';

  // Calculate name similarities
  const productNameSimilarity = calculateStringSimilarity(normalizedSearch, normalizedProductName);
  const vendorProductNameSimilarity = calculateStringSimilarity(normalizedSearch, normalizedVendorProductName);

  // Apply weights to name matches
  const weightedNameScore = Math.max(
    productNameSimilarity * NAME_MATCH_WEIGHTS.MAIN_PRODUCT_NAME,
    vendorProductNameSimilarity * NAME_MATCH_WEIGHTS.MAIN_VENDOR_PRODUCT_NAME
  );

  // Set initial confidence based on name match
  confidence_score = weightedNameScore;
  match_criteria.name_match = weightedNameScore > 0.8;

  // Check vendor match
  if (vendorName && vendorUid) {
    const vendorMatch = normalizedVendorUid === vendorUid.toLowerCase().trim();
    if (vendorMatch) {
      confidence_score += 0.1;
      match_criteria.vendor_match = true;
      matchDetails.push('Vendor match');
    }
  }

  // Check PO match
  if (poNumber && candidate.rowid_purchase_order_row_id) {
    const poMatch = candidate.rowid_purchase_order_row_id.toLowerCase().includes(poNumber.toLowerCase());
    if (poMatch) {
      confidence_score += 0.2;
      match_criteria.po_match = true;
      matchDetails.push('PO match');
    }
  }

  // Check purchase date match
  if (purchaseDate && candidate.main_product_purchase_date) {
    const dateMatch = new Date(purchaseDate).toDateString() === 
                     new Date(candidate.main_product_purchase_date).toDateString();
    if (dateMatch) {
      confidence_score += 0.1;
      match_criteria.date_match = true;
      matchDetails.push('Purchase date match');
    }
  }

  // Cap confidence at 1.0
  confidence_score = Math.min(confidence_score, 1);

  // Determine priority level based on match criteria
  if (match_criteria.po_match && confidence_score >= PRIORITY_LEVELS.EXACT_PO_HIGH_NAME.minConfidence) {
    match_priority = PRIORITY_LEVELS.EXACT_PO_HIGH_NAME.level;
  } else if (match_criteria.name_match && match_criteria.vendor_match && match_criteria.date_match) {
    match_priority = PRIORITY_LEVELS.EXACT_NAME_VENDOR_DATE.level;
  } else if (match_criteria.po_match && confidence_score >= PRIORITY_LEVELS.EXACT_PO_FUZZY_NAME.minConfidence) {
    match_priority = PRIORITY_LEVELS.EXACT_PO_FUZZY_NAME.level;
  } else if (confidence_score >= PRIORITY_LEVELS.FUZZY_NAME_VENDOR_DATE.minConfidence) {
    match_priority = PRIORITY_LEVELS.FUZZY_NAME_VENDOR_DATE.level;
  }

  return {
    product_id: candidate.id,
    glide_id: candidate.glide_id,
    confidence_score,
    match_priority,
    match_details: matchDetails.join(', '),
    match_criteria
  };
}

/**
 * Find best matching product from candidates
 */
export function findBestProductMatch(
  candidates: GlProduct[],
  searchName: string,
  vendorName?: string,
  poNumber?: string,
  vendorUid?: string,
  purchaseDate?: string,
  minConfidence = PRIORITY_LEVELS.FUZZY_NAME_VENDOR_DATE.minConfidence
): { matches: ProductMatch[], bestMatch: ProductMatch | null } {
  const matches: ProductMatch[] = candidates.map(candidate => 
    calculateProductMatch(searchName, candidate, vendorName, poNumber, vendorUid, purchaseDate)
  ).filter(match => match.confidence_score >= minConfidence);

  // Sort matches by priority first, then confidence
  matches.sort((a, b) => {
    if (a.match_priority !== b.match_priority) {
      return a.match_priority - b.match_priority; // Lower priority number is better
    }
    return b.confidence_score - a.confidence_score; // Higher confidence is better
  });

  return {
    matches,
    bestMatch: matches.length > 0 ? matches[0] : null
  };
}
