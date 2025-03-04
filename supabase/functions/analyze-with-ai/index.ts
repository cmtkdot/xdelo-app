
import { createHandler } from '../_shared/baseHandler.ts';
import { OpenAI } from "https://esm.sh/openai@4.20.1";

export default createHandler(async (req: Request) => {
  const { messageId, caption } = await req.json();

  if (!messageId || !caption) {
    return new Response(
      JSON.stringify({ error: 'Missing required parameters' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    console.error('Missing OpenAI API key');
    return new Response(
      JSON.stringify({ error: 'Configuration error: Missing API key' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const openai = new OpenAI({
    apiKey,
    timeout: 15000, // 15 second timeout
  });

  try {
    console.log(`Processing AI analysis for message ${messageId}`);
    
    // Define a retry mechanism
    const maxRetries = 2;
    let retries = 0;
    let response;
    let error;

    while (retries <= maxRetries) {
      try {
        response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { 
              role: "system", 
              content: `You are a product information extraction assistant. Extract structured data from the given caption.
                Please return only JSON in this exact format:
                {
                  "product_name": "Full product name",
                  "product_code": "Code found after # symbol",
                  "vendor_uid": "1-4 letter vendor code (usually first part of product_code)",
                  "purchase_date": "Date in YYYY-MM-DD format",
                  "quantity": number or null,
                  "notes": "Any additional details"
                }` 
            },
            { 
              role: "user", 
              content: `Extract product details from this caption: "${caption}"` 
            }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        });
        
        // If we get here, the API call was successful
        break;
      } catch (err) {
        error = err;
        console.error(`AI analysis attempt ${retries + 1} failed:`, err);
        
        // Exponential backoff
        if (retries < maxRetries) {
          const delay = Math.pow(2, retries) * 1000;
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        retries++;
      }
    }
    
    if (!response) {
      throw error || new Error('Failed to get response from AI after retries');
    }

    const result = response.choices[0].message.content;
    console.log('AI analysis completed successfully');

    try {
      // Verify we have valid JSON output
      const parsedResult = JSON.parse(result);
      return new Response(
        JSON.stringify({ success: true, data: parsedResult }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (parseError) {
      console.error('Invalid JSON returned from AI:', parseError);
      return new Response(
        JSON.stringify({ 
          error: 'AI returned invalid format', 
          partialResult: result 
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error during AI analysis:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        errorType: error.name,
        status: 'failed'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
