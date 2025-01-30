export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export async function validateWebhookSecret(req: Request): Promise<void> {
  const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  if (!WEBHOOK_SECRET) {
    console.error("❌ TELEGRAM_WEBHOOK_SECRET is not set");
    throw new Error("Webhook secret is not configured");
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    console.error("❌ No Authorization header provided");
    throw new Error("No webhook secret provided");
  }

  const providedSecret = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  const encoder = new TextEncoder();
  const secretsMatch = await crypto.subtle.verify(
    "HMAC",
    await crypto.subtle.importKey(
      "raw",
      encoder.encode(WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    ),
    await crypto.subtle.digest("SHA-256", encoder.encode(providedSecret)),
    encoder.encode(WEBHOOK_SECRET)
  );

  if (!secretsMatch) {
    console.error("❌ Invalid webhook secret provided");
    throw new Error("Invalid webhook secret");
  }

  console.log("✅ Webhook secret verified");
}