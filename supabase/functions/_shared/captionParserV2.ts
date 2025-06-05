import { AnalyzedContent, ParsingStage, ParsedContent } from "./types.ts";

type ParserStage = {
  name: string;
  pattern: RegExp;
  handler: (match: RegExpMatchArray, content: AnalyzedContent) => void;
  optional?: boolean;
};

export function parseCaptionV2(caption: string): AnalyzedContent {
  const result: ParsedContent = {
    caption: caption,
    product_name: '',
    product_code: '',
    vendor_uid: undefined,
    purchase_date: undefined,
    quantity: undefined,
    notes: '',
    parsing_metadata: {
      method: 'v2',
      timestamp: new Date().toISOString(),
      stages: [] as ParsingStage[]
    }
  };

  const stages: ParserStage[] = [
    // Product code extraction (e.g. #VEND123456)
    {
      name: 'product_code',
      pattern: /#([A-Za-z]{1,4}\d{5,6})/,
      handler: (match, content) => {
        content.product_code = match[1];
        content.vendor_uid = match[1].substring(0, match[1].match(/[A-Za-z]/g)?.length || 0);
        content.purchase_date = parsePurchaseDate(match[1].substring(content.vendor_uid?.length || 0));
      }
    },
    // Quantity patterns (e.g. x3 or 3x)
    {
      name: 'quantity',
      pattern: /(?:^|\s)(?:x\s*(\d+)|(\d+)\s*x)(?:\s|$)/i,
      handler: (match, content) => {
        content.quantity = parseInt(match[1] || match[2], 10);
      },
      optional: true
    },
    // Product name (text before code or whole caption)
    {
      name: 'product_name',
      pattern: /^(.+?)(?=\s*#|$)/,
      handler: (match, content) => {
        if (!content.product_name) {
          content.product_name = match[1].trim();
        }
      }
    },
    // Notes in parentheses
    {
      name: 'notes',
      pattern: /\(([^)]+)\)/,
      handler: (match, content) => {
        content.notes = match[1].trim();
      },
      optional: true
    }
  ];

  // Process each parsing stage
  for (const stage of stages) {
    try {
      const match = caption.match(stage.pattern);
      if (match) {
        stage.handler(match, result);
      result.parsing_metadata.stages!.push({
          name: stage.name,
          success: true,
          match: match[0]
        });
      } else if (!stage.optional) {
        result.parsing_metadata.stages!.push({
          name: stage.name,
          success: false,
          error: 'Pattern not found'
        });
      }
    } catch (error) {
      result.parsing_metadata.stages!.push({
        name: stage.name,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Handle missing required fields
  const missingFields: string[] = [];
  if (!result.product_name) missingFields.push('product_name');
  if (!result.product_code) missingFields.push('product_code');
  if (!result.vendor_uid) missingFields.push('vendor_uid');
  if (!result.purchase_date) missingFields.push('purchase_date');
  if (!result.quantity) missingFields.push('quantity');

  if (missingFields.length > 0) {
    result.parsing_metadata.partial_success = true;
    result.parsing_metadata.missing_fields = missingFields;
  }

  return result;
}

function parsePurchaseDate(digits: string): string {
  if (digits.length === 5) digits = `0${digits}`;
  if (digits.length !== 6) throw new Error('Invalid date format');

  const month = digits.substring(0, 2);
  const day = digits.substring(2, 4);
  const year = `20${digits.substring(4, 6)}`;

  const date = new Date(`${year}-${month}-${day}`);
  if (isNaN(date.getTime())) throw new Error('Invalid date');

  return `${year}-${month}-${day}`;
}
