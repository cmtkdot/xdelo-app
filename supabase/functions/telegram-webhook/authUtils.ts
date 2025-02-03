export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export async function validateWebhookSecret(req: Request): Promise<void> {
  console.log("Starting webhook secret validation");
  
  const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  if (!WEBHOOK_SECRET) {
    console.error("Webhook secret is not configured in environment variables");
    throw new Error("Webhook secret is not configured");
  }

  const authHeader = req.headers.get("Authorization");
  console.log("Auth header present:", !!authHeader);
  
  if (!authHeader) {
    throw new Error("Missing Authorization header");
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    console.error("Invalid Authorization header format");
    throw new Error("Invalid Authorization header format");
  }

  const encoder = new TextEncoder();
  const secretsMatch = await crypto.subtle.timingSafeEqual(
    encoder.encode(token),
    encoder.encode(WEBHOOK_SECRET)
  );

  if (!secretsMatch) {
    console.error("Invalid webhook secret provided");
    throw new Error("Invalid webhook secret");
  }

  console.log("Webhook secret validation successful");
}