
import { supabase } from '@/integrations/supabase/client'

export interface ProductMatchingConfig {
  enabled: boolean
  auto_match: boolean
  confidence_threshold: number
  webhook_url?: string
}

export async function getProductMatchingConfig(): Promise<ProductMatchingConfig> {
  try {
    // For now, return default config since we don't have the edge function set up
    return {
      enabled: true,
      auto_match: false,
      confidence_threshold: 0.8
    }
  } catch (error) {
    console.error('Error fetching product matching config:', error)
    // Return default config on error
    return {
      enabled: false,
      auto_match: false,
      confidence_threshold: 0.8
    }
  }
}

export async function updateProductMatchingConfig(
  config: Partial<ProductMatchingConfig>
): Promise<{ success: boolean; error?: string }> {
  try {
    // For now, just return success since we don't have the edge function set up
    console.log('Would update config:', config)
    return { success: true }
  } catch (error) {
    console.error('Error updating product matching config:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export async function testProductMatchingConfig(): Promise<{ success: boolean; error?: string }> {
  try {
    // For now, just return success since we don't have the edge function set up
    return { success: true }
  } catch (error) {
    console.error('Error testing product matching config:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
