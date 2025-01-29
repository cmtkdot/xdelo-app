import OpenAI from "https://esm.sh/openai@4.28.0";
import { AnalyzedContent, AIResponse } from "../types.ts";
import { parseManually } from "./manualParser.ts";

export async function analyzeCaption(caption: string): Promise<AIResponse> {
  try {
    console.log("Analyzing caption:", caption);

    const openai = new OpenAI({
      apiKey: Deno.env.get("OPENAI_API_KEY"),
    });

    const systemPrompt = `You are a product data extractor. Extract the following information from the given text:
    1. Product name (exclude any codes or quantities)
    2. Product code (starting with #)
    3. Quantity (number following 'x')
    4. Vendor ID (letters in the product code before any numbers)
    5. Purchase date (numbers in the product code)
       - Format: MMDDYY or MDDYY (5 or 6 digits)
       - Example 1: #CHAD120523 → 2023-12-05 (MMDDYY)
       - Example 2: #CHAD12345 → 2023-01-23 (MDDYY)
       - Return null if date is invalid or in future
    6. Notes (any text in parentheses)`;

    console.log("Making OpenAI API request...");
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: caption },
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const response = completion.choices[0].message.content.trim();
    console.log("AI Response:", response);

    let extractedData: AnalyzedContent;
    try {
      extractedData = JSON.parse(response);
    } catch (error) {
      console.error("Error parsing AI response:", error);
      console.log("Falling back to manual parsing");
      extractedData = parseManually(caption);
    }

    return {
      caption,
      extracted_data: extractedData,
      confidence: 0.9,
      timestamp: new Date().toISOString(),
      model_version: "1.0",
    };
  } catch (error) {
    console.error("Error in caption analysis:", error);
    console.log("Error details:", error.message);
    if (error.response) {
      console.error("OpenAI API Error:", error.response.data);
    }
    console.log("Falling back to manual parsing due to error");
    return {
      caption,
      extracted_data: parseManually(caption),
      confidence: 0.5,
      timestamp: new Date().toISOString(),
      model_version: "1.0",
      error: error.message,
    };
  }
}