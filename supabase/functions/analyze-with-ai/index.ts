import { createHandler } from '../_shared/baseHandler.ts';
import { Configuration, OpenAIApi } from "openai";

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
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: caption }],
    });

    const result = response.data.choices[0].message.content;

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
