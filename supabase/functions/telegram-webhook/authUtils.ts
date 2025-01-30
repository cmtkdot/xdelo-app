export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export async function validateWebhookSecret(req: Request): Promise<void> {
  console.log("🔐 Starting webhook secret validation");
  
  // Get the secret from environment
  const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  if (!WEBHOOK_SECRET) {
    console.error("❌ TELEGRAM_WEBHOOK_SECRET is not set in environment variables");
    throw new Error("Webhook secret is not configured");
  }
  console.log("✅ Found webhook secret in environment");

  // Check for Authorization header
  const authHeader = req.headers.get("Authorization");
  console.log("🔍 Authorization header:", authHeader ? "Present" : "Missing");
  
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
  console.log("✅ Successfully extracted secret from Authorization header");

  // Log the first few characters of both secrets for debugging
  console.log("🔑 Webhook secret starts with:", WEBHOOK_SECRET.substring(0, 4) + "...");
  console.log("🔑 Provided secret starts with:", providedSecret.substring(0, 4) + "...");

  // Perform constant-time comparison of secrets
  try {
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
  } catch (error) {
    console.error("❌ Error during secret comparison:", error);
    throw new Error("Secret validation failed");
  }
}