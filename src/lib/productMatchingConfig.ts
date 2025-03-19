
/**
 * Configuration for product matching algorithm
 */
export const CONFIG = {
  similarityThreshold: 0.7,
  weightedScoring: {
    productName: 0.4,
    vendorUid: 0.3,
    purchaseDate: 0.3
  },
  partialMatch: {
    enabled: true,
    vendorMinLength: 2,
    dateFormat: 'YYYY-MM-DD'
  }
};

/**
 * Update configuration settings from UI or other sources
 */
export const updateConfig = (newConfig: Partial<typeof CONFIG>) => {
  Object.assign(CONFIG, newConfig);
  return { ...CONFIG };
};
