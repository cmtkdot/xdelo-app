export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export async function validateWebhookSecret(req: Request): Promise<void> {
  const secret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  if (!secret) {
    console.error("TELEGRAM_WEBHOOK_SECRET is not set");
    throw new Error("Webhook secret is not configured");
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    console.error("No Authorization header present");
    throw new Error("Missing Authorization header");
  }

  // Simple string comparison since we're using a secure random string
  if (authHeader !== `Bearer ${secret}`) {
    console.error("Invalid webhook secret");
    throw new Error("Invalid webhook secret");
  }
}