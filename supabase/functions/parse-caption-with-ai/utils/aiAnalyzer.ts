import { ParsedContent } from "../../_shared/types.ts";
import { manualParse } from "./manualParser.ts";

const SYSTEM_PROMPT = `You are a product data extractor specialized in analyzing product listings. Extract structured information from product descriptions.

Required fields to extract:
- product_name: The main product name (REQUIRED)
- product_code: Product code or reference number (format: alphanumeric after #)
- vendor_uid: Vendor identifier (1-4 uppercase letters from product code)
- quantity: Numeric quantity (must be positive integer)
- purchase_date: Date in YYYY-MM-DD format (from product code or explicit date)
- notes: Additional details or variations

Instructions:
1. Extract product code from text after # symbol
2. Derive vendor_uid from first letters of product code
3. Look for dates in both product code and text
4. Handle multi-line product listings in notes
5. Preserve any structured format in notes`;

interface ValidationResult {
  isValid: boolean;
  confidence: number;
}

function validateContent(content: ParsedContent): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    confidence: 0.7 // Base confidence
  };

  // Required field validation
  if (!content.product_name) {
    result.isValid = false;
    result.confidence = 0.3;
    return result;
  }

  // Product code and vendor validation
  if (content.product_code && content.vendor_uid) {
    result.confidence += 0.1;
  }

  // Quantity validation
  if (content.quantity !== undefined && Number.isInteger(content.quantity) && content.quantity > 0) {
    result.confidence += 0.1;
  }

  // Date validation
  if (content.purchase_date && !isNaN(new Date(content.purchase_date).getTime())) {
    result.confidence += 0.1;
  }

  return result;
}

function sanitizeText(text: string): string {
  return text.replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
             .replace(/\s+/g, ' ')
             .trim();
}

export async function analyzeCaption(caption: string): Promise<ParsedContent> {
  try {
    console.log("Starting caption analysis:", caption);

    // First try manual parsing
    const manualResult = await manualParse(caption);
    if (manualResult?.product_name) {
      console.log('Successfully parsed caption manually:', manualResult);
      return manualResult;
    }

    // Fallback to AI analysis
    console.log('Manual parsing incomplete, attempting AI analysis');
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const sanitizedCaption = sanitizeText(caption);
    const contextPrompt = manualResult 
      ? `Previous manual analysis found:\n${JSON.stringify(manualResult, null, 2)}\nUse this as context and improve if possible.`
      : '';

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `${contextPrompt}\nAnalyze this product caption: "${sanitizedCaption}"` }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const aiContent = aiResponse.choices[0].message.content;
    
    let analyzedContent: ParsedContent = {};
    try {
      analyzedContent = JSON.parse(aiContent);
    } catch (e) {
      analyzedContent = extractFromText(aiContent);
    }

    // Merge with existing content, preferring manual values when confidence was high
    if (manualResult && manualResult.parsing_metadata?.confidence >= 0.75) {
      analyzedContent = {
        ...analyzedContent,
        product_code: manualResult.product_code || analyzedContent.product_code,
        vendor_uid: manualResult.vendor_uid || analyzedContent.vendor_uid,
        purchase_date: manualResult.purchase_date || analyzedContent.purchase_date
      };
    }

    const validation = validateContent(analyzedContent);

    const parsingMetadata = {
      method: manualResult ? 'ai_with_manual' : 'ai_only',
      confidence: validation.confidence,
      timestamp: new Date().toISOString()
    };

    console.log('AI analysis result:', analyzedContent);
    return { ...analyzedContent, parsing_metadata: parsingMetadata };

  } catch (error) {
    console.error('Error analyzing caption:', error);
    // Return basic info even if analysis fails
    return {
      product_name: caption.split('\n')[0]?.trim() || 'Untitled Product',
      notes: '',
      parsing_metadata: {
        method: 'ai',
        confidence: 0.1,
        timestamp: new Date().toISOString(),
        fallbacks_used: ['error_fallback']
      }
    };
  }
}

function extractFromText(text: string): ParsedContent {
  const content: ParsedContent = {};
  const lines = text.split('\n');

  for (const line of lines) {
    const [key, ...valueParts] = line.split(':');
    const value = valueParts.join(':').trim();
    
    switch (key.trim().toLowerCase()) {
      case 'product_name':
        content.product_name = value;
        break;
      case 'product_code':
        content.product_code = value;
        break;
      case 'vendor_uid':
        content.vendor_uid = value.toUpperCase();
        break;
      case 'quantity':
        const qty = parseInt(value);
        if (!isNaN(qty)) content.quantity = qty;
        break;
      case 'purchase_date':
        if (!isNaN(new Date(value).getTime())) {
          content.purchase_date = value;
        }
        break;
      case 'notes':
        content.notes = value;
        break;
    }
  }

  return content;
}
