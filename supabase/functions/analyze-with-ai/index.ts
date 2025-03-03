
import { createHandler } from '../_shared/baseHandler.ts';
// Replace the direct 'openai' import with the proper URL import
import { Configuration, OpenAIApi } from "https://esm.sh/openai@3.3.0";

export default createHandler(async (req: Request) => {
  const { messageId, caption } = await req.json();

  if (!messageId || !caption) {
    return new Response(
      JSON.stringify({ error: 'Missing required parameters' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const configuration = new Configuration({
    apiKey: Deno.env.get("OPENAI_API_KEY"),
  });
  const openai = new OpenAIApi(configuration);

  try {
    console.log(`Processing AI analysis for message ${messageId}`);
    
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        { 
          role: "system", 
          content: "You are a product information extractor. Extract product details from the given caption." 
        },
        { 
          role: "user", 
          content: `Extract product name, product code, vendor ID, purchase date, and quantity from this caption: ${caption}` 
        }
      ],
      temperature: 0.3
    });

    const result = response.data.choices[0].message.content;
    console.log('AI analysis completed successfully');

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error during AI analysis:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
