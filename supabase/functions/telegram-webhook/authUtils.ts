export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export async function validateWebhookSecret(req: Request): Promise<void> {
  const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  if (!WEBHOOK_SECRET) {
    throw new Error("Webhook secret is not configured");
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("Missing Authorization header");
  }

  const providedSecret = authHeader.replace("Bearer ", "");
  if (!providedSecret) {
    throw new Error("Invalid Authorization header format");
  }

  const encoder = new TextEncoder();
  const secretsMatch = await crypto.subtle.timingSafeEqual(
    encoder.encode(providedSecret),
    encoder.encode(WEBHOOK_SECRET)
  );

  if (!secretsMatch) {
    throw new Error("Invalid webhook secret");
  }
}