
/**
 * Core product entity representing an inventory item
 */
export interface GlProduct {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  price?: number;
  createdAt: string;
  updatedAt?: string;
  imageUrl?: string;
  category?: string;
  tags?: string[];
  vendor?: string;
  quantity?: number;
  attributes?: Record<string, string | number | boolean>;
  metadata?: Record<string, any>;
}
