
import { supabase } from './client';
import { GlProduct } from './databaseExtensions';

// Helper function to fetch GL products safely
export async function fetchGlProducts(options: {
  limit?: number;
  productIds?: string[];
  searchTerm?: string;
}) {
  try {
    // Use the gl-products-lookup edge function to avoid type issues
    const { data, error } = await supabase.functions.invoke('gl-products-lookup', {
      body: {
        productIds: options.productIds,
        limit: options.limit || 50,
        searchTerm: options.searchTerm
      }
    });
    
    if (error) {
      console.error('Error fetching GL products:', error);
      return { data: null, error };
    }
    
    return { data: data as GlProduct[], error: null };
  } catch (error) {
    console.error('Exception in fetchGlProducts:', error);
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error('Unknown error') 
    };
  }
}

// Helper to get a single product by ID
export async function getGlProductById(productId: string): Promise<GlProduct | null> {
  const { data, error } = await fetchGlProducts({ productIds: [productId] });
  
  if (error || !data || data.length === 0) {
    return null;
  }
  
  return data[0];
}
