export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export async function validateWebhookSecret(req: Request): Promise<void> {
  const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  if (!WEBHOOK_SECRET) {
    console.error("❌ TELEGRAM_WEBHOOK_SECRET is not set in environment variables");
    throw new Error("Webhook secret is not configured");
  }

  // Check for Authorization header
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    console.error("❌ No Authorization header provided");
    throw new Error("No webhook secret provided");
  }

  // Extract the secret from the Authorization header
  const providedSecret = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  if (!providedSecret) {
    console.error("❌ No secret provided in Authorization header");
    throw new Error("No webhook secret provided");
  }

  // Perform constant-time comparison of secrets
  const encoder = new TextEncoder();
  const secretsMatch = await crypto.subtle.timingSafeEqual(
    encoder.encode(providedSecret),
    encoder.encode(WEBHOOK_SECRET)
  );

  if (!secretsMatch) {
    console.error("❌ Invalid webhook secret provided");
    throw new Error("Invalid webhook secret");
  }

  console.log("✅ Webhook secret verified successfully");
}