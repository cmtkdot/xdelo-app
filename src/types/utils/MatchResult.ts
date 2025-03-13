
/**
 * Result of a matching operation
 */
export interface MatchResult {
  isMatch: boolean;
  score: number;
  matches: {
    [key: string]: {
      value: string;
      score: number;
    };
  };
}
