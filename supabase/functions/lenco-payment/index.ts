import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { amount, phone, reference, operator = "mtn", country = "zm" } = await req.json();
    const secretKey = Deno.env.get("LENCO_SECRET_KEY");
    const baseUrl = (Deno.env.get("LENCO_BASE_URL") || "https://api.lenco.co/access/v2").replace(/\/$/, "");

    if (!secretKey) {
      return new Response(JSON.stringify({ error: "Payment service not configured", userMessage: "Payment service is not configured." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || !phone || !reference) {
      return new Response(JSON.stringify({ error: "Missing or invalid payment fields", userMessage: "Please provide a valid amount and phone number." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(`${baseUrl}/collections/mobile-money`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: numericAmount,
        reference: String(reference),
        phone: String(phone).replace(/\s+/g, ""),
        operator: String(operator).toLowerCase(),
        country: String(country).toLowerCase(),
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Lenco payment failed", response.status, data);
      return new Response(JSON.stringify({
        error: "Payment initiation failed",
        userMessage: data?.message || "Unable to start the payment. Please try again.",
      }), { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const redirectUrl = data?.redirect_url || data?.redirectUrl || data?.checkout_url || data?.data?.redirect_url || data?.data?.checkout_url;
    return new Response(JSON.stringify({ success: true, redirectUrl, raw: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("lenco-payment error", error);
    return new Response(JSON.stringify({ error: "Internal payment error", userMessage: "Unable to start the payment. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
