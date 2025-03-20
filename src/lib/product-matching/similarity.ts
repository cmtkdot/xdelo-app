/**
 * String similarity algorithms for product matching
 */

/**
 * Calculate Jaro-Winkler similarity between two strings
 * Returns a score between 0 (no similarity) and 1 (exact match)
 */
export function jaroWinklerSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;

  str1 = str1.toLowerCase();
  str2 = str2.toLowerCase();

  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1;

  // Quick exact match check
  if (str1 === str2) return 1.0;

  // Calculate Jaro-Winkler similarity
  let matches = 0;
  let transpositions = 0;
  const matchDistance = Math.floor(Math.max(str1.length, str2.length) / 2) - 1;
  const str1Matches = new Array(str1.length).fill(false);
  const str2Matches = new Array(str2.length).fill(false);

  // Find matching characters within match distance
  for (let i = 0; i < str1.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, str2.length);

    for (let j = start; j < end; j++) {
      if (!str2Matches[j] && str1[i] === str2[j]) {
        str1Matches[i] = true;
        str2Matches[j] = true;
        matches++;
        break;
      }
    }
  }

  // If no matches, return 0
  if (matches === 0) return 0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < str1.length; i++) {
    if (str1Matches[i]) {
      while (!str2Matches[k]) k++;
      if (str1[i] !== str2[k]) transpositions++;
      k++;
    }
  }

  // Calculate Jaro similarity
  const jaroSimilarity = (
    matches / str1.length +
    matches / str2.length +
    (matches - transpositions / 2) / matches
  ) / 3;

  // Apply Winkler modification (boost for common prefixes)
  let prefixLength = 0;
  const maxPrefixLength = 4;
  while (
    prefixLength < maxPrefixLength &&
    prefixLength < str1.length &&
    prefixLength < str2.length &&
    str1[prefixLength] === str2[prefixLength]
  ) {
    prefixLength++;
  }

  // Winkler scaling factor = 0.1
  return jaroSimilarity + prefixLength * 0.1 * (1 - jaroSimilarity);
}

/**
 * Calculate Levenshtein distance between two strings
 * Lower number means strings are more similar
 */
export function levenshteinDistance(str1: string, str2: string): number {
  if (!str1) return str2 ? str2.length : 0;
  if (!str2) return str1.length;

  const matrix: number[][] = [];

  // Initialize the matrix
  for (let i = 0; i <= str1.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[0][j] = j;
  }

  // Fill the matrix
  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str1.length][str2.length];
}

/**
 * Calculate string similarity using Levenshtein distance
 * Returns a score between 0 (no similarity) and 1 (exact match)
 */
export function levenshteinSimilarity(str1?: string, str2?: string): number {
  if (!str1 || !str2) return 0;
  
  str1 = str1.toLowerCase();
  str2 = str2.toLowerCase();
  
  // Quick exact match check
  if (str1 === str2) return 1.0;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  const longerLength = longer.length;

  if (longerLength === 0) return 1.0;

  const distance = levenshteinDistance(longer, shorter);
  return (longerLength - distance) / longerLength;
}

/**
 * Get best string similarity score using multiple algorithms
 */
export function calculateStringSimilarity(
  str1?: string, 
  str2?: string, 
  options = { useJaroWinkler: true, useLevenshtein: true }
): number {
  if (!str1 || !str2) return 0;
  
  // Quick exact match check
  if (str1.toLowerCase() === str2.toLowerCase()) return 1.0;
  
  const scores: number[] = [];
  
  if (options.useJaroWinkler) {
    scores.push(jaroWinklerSimilarity(str1, str2));
  }
  
  if (options.useLevenshtein) {
    scores.push(levenshteinSimilarity(str1, str2));
  }
  
  // If no algorithms were selected, use Jaro-Winkler as default
  if (scores.length === 0) {
    return jaroWinklerSimilarity(str1, str2);
  }
  
  // Return the highest similarity score
  return Math.max(...scores);
} 