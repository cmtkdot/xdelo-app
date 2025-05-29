import { supabase } from '@/integrations/supabase/client'
import { Message } from '@/types'
import type { Database } from '@/integrations/supabase/types'

export interface MatchResult {
  success: boolean
  matchedProduct?: any
  message?: string
  error?: string
}

export interface ProductMatchingConfig {
  enabled: boolean
  auto_match: boolean
  confidence_threshold: number
  webhook_url?: string
}

// Function to fetch product matching configuration from the database
// In a real-world scenario, this would fetch from a settings table
// or an edge function that provides the configuration.
async function getProductMatchingConfig(): Promise<ProductMatchingConfig> {
  // Return default config for now
  return {
    enabled: true,
    auto_match: false,
    confidence_threshold: 0.8
  }
}

// Function to update the product matching configuration
// This would update the settings in the database.
export async function updateProductMatchingConfig(
  config: Partial<ProductMatchingConfig>
): Promise<{ success: boolean; error?: string }> {
  try {
    // For now, just return success since we don't have a config table
    return { success: true }
  } catch (error) {
    console.error('Error updating product matching config:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export async function performProductMatch(message: Message): Promise<MatchResult> {
  try {
    // Validate input
    if (!message?.id) {
      return {
        success: false,
        error: 'Invalid message provided'
      }
    }

    // Get product matching configuration
    const config = await getProductMatchingConfig()
    if (!config.enabled) {
      return {
        success: false,
        message: 'Product matching is disabled'
      }
    }

    // Extract product information from analyzed_content
    const analyzedContent = message.analyzed_content
    if (!analyzedContent || typeof analyzedContent !== 'object') {
      return {
        success: false,
        message: 'No analyzed content available for matching'
      }
    }

    // Perform the matching logic here
    // This is a placeholder - implement your actual matching logic
    const matchedProduct = await findMatchingProduct(analyzedContent)

    if (matchedProduct) {
      // Update the message with the matched product
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          product_id: matchedProduct.id,
          product_match_status: 'matched',
          product_match_date: new Date().toISOString()
        })
        .eq('id', message.id)

      if (updateError) {
        console.error('Error updating message with matched product:', updateError)
        return {
          success: false,
          error: 'Failed to update message with matched product'
        }
      }

      return {
        success: true,
        matchedProduct,
        message: 'Product matched successfully'
      }
    }

    return {
      success: false,
      message: 'No matching product found'
    }

  } catch (error) {
    console.error('Error in performProductMatch:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

async function findMatchingProduct(analyzedContent: any): Promise<any | null> {
  // Implement your product matching logic here
  // This could involve searching your products database
  // using the product_name, product_code, vendor_uid, etc.
  
  try {
    const { data: products, error } = await supabase
      .from('gl_products')
      .select('*')
      .limit(10) // Adjust as needed

    if (error) {
      console.error('Error fetching products:', error)
      return null
    }

    // Simple matching logic - you can make this more sophisticated
    if (analyzedContent.product_name) {
      const match = products?.find(product => 
        product.vendor_product_name?.toLowerCase().includes(analyzedContent.product_name.toLowerCase()) ||
        product.new_product_name?.toLowerCase().includes(analyzedContent.product_name.toLowerCase())
      )
      return match || null
    }

    return null
  } catch (error) {
    console.error('Error in findMatchingProduct:', error)
    return null
  }
}
