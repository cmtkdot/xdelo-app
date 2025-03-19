
import { CONFIG } from './config.ts';
import { createSupabaseClient } from './supabase.ts';

interface TelegramSettings {
  botToken: string;
  webhookUrl: string;
  isValid: boolean;
  errors: string[];
}

/**
 * Retrieves and validates Telegram bot settings from the database
 */
export async function xdelo_getTelegramSettings(): Promise<TelegramSettings> {
  const supabaseClient = createSupabaseClient();
  const errors: string[] = [];
  
  try {
    // Get settings from database
    const { data: settings, error } = await supabaseClient
      .from('settings')
      .select('bot_token, webhook_url')
      .single();
    
    if (error) {
      console.error('Error retrieving Telegram settings:', error);
      errors.push(`Database error: ${error.message}`);
      return {
        botToken: '',
        webhookUrl: '',
        isValid: false,
        errors
      };
    }
    
    // Validate bot token
    const botToken = settings?.bot_token || Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
    if (!botToken) {
      errors.push(CONFIG.ERROR_MESSAGES.TELEGRAM_BOT_TOKEN_MISSING);
    }
    
    // Validate webhook URL
    const webhookUrl = settings?.webhook_url || '';
    if (!webhookUrl) {
      errors.push(CONFIG.ERROR_MESSAGES.WEBHOOK_URL_MISSING);
    }
    
    // Check if both values are valid
    const isValid = errors.length === 0;
    
    return {
      botToken,
      webhookUrl,
      isValid,
      errors
    };
  } catch (err) {
    console.error('Exception retrieving Telegram settings:', err);
    errors.push(`Unexpected error: ${err.message}`);
    return {
      botToken: '',
      webhookUrl: '',
      isValid: false,
      errors
    };
  }
}

/**
 * Sets up or updates the Telegram webhook
 */
export async function xdelo_setTelegramWebhook(): Promise<{
  success: boolean;
  message: string;
  webhookInfo?: any;
}> {
  try {
    // Get settings
    const settings = await xdelo_getTelegramSettings();
    
    if (!settings.isValid) {
      return {
        success: false,
        message: `Invalid settings: ${settings.errors.join(', ')}`
      };
    }
    
    // Construct the webhook URL
    let webhookUrl = settings.webhookUrl;
    if (!webhookUrl.endsWith('/')) {
      webhookUrl += '/';
    }
    webhookUrl += CONFIG.TELEGRAM.WEBHOOK_PATH;
    
    // Set the webhook
    const botToken = settings.botToken;
    const response = await fetch(
      `${CONFIG.API.TELEGRAM_API}/bot${botToken}/setWebhook`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: webhookUrl,
          max_connections: CONFIG.TELEGRAM.MAX_CONNECTIONS,
          allowed_updates: CONFIG.TELEGRAM.ALLOWED_UPDATES,
          secret_token: CONFIG.TELEGRAM.WEBHOOK_SECRET
        })
      }
    );
    
    const result = await response.json();
    
    if (!result.ok) {
      return {
        success: false,
        message: `Telegram API error: ${result.description}`
      };
    }
    
    // Get webhook info for verification
    const infoResponse = await fetch(
      `${CONFIG.API.TELEGRAM_API}/bot${botToken}/getWebhookInfo`
    );
    
    const webhookInfo = await infoResponse.json();
    
    return {
      success: true,
      message: 'Webhook set successfully',
      webhookInfo: webhookInfo.result
    };
  } catch (error) {
    console.error('Error setting Telegram webhook:', error);
    return {
      success: false,
      message: `Failed to set webhook: ${error.message}`
    };
  }
}

/**
 * Validates the current webhook configuration
 */
export async function xdelo_validateTelegramWebhook(): Promise<{
  success: boolean;
  message: string;
  webhookInfo?: any;
}> {
  try {
    // Get settings
    const settings = await xdelo_getTelegramSettings();
    
    if (!settings.isValid) {
      return {
        success: false,
        message: `Invalid settings: ${settings.errors.join(', ')}`
      };
    }
    
    // Get webhook info
    const botToken = settings.botToken;
    const response = await fetch(
      `${CONFIG.API.TELEGRAM_API}/bot${botToken}/getWebhookInfo`
    );
    
    const result = await response.json();
    
    if (!result.ok) {
      return {
        success: false,
        message: `Telegram API error: ${result.description}`
      };
    }
    
    const webhookInfo = result.result;
    
    // Check if webhook is set
    if (!webhookInfo.url) {
      return {
        success: false,
        message: 'Webhook URL is not set',
        webhookInfo
      };
    }
    
    // Construct expected webhook URL
    let expectedUrl = settings.webhookUrl;
    if (!expectedUrl.endsWith('/')) {
      expectedUrl += '/';
    }
    expectedUrl += CONFIG.TELEGRAM.WEBHOOK_PATH;
    
    // Check if webhook URL matches expected
    if (webhookInfo.url !== expectedUrl) {
      return {
        success: false,
        message: `Webhook URL mismatch: currently set to ${webhookInfo.url} but should be ${expectedUrl}`,
        webhookInfo
      };
    }
    
    return {
      success: true,
      message: 'Webhook configuration is valid',
      webhookInfo
    };
  } catch (error) {
    console.error('Error validating Telegram webhook:', error);
    return {
      success: false,
      message: `Failed to validate webhook: ${error.message}`
    };
  }
}
