import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      amount,
      currency = 'ZMW',
      reference,
      payer,
      provider = 'MTN_MOMO_ZMB',
    } = body;

    const apiKey = Deno.env.get('MOBILE_MONEY_API_KEY');
    const keyId = Deno.env.get('MOBILE_MONEY_KEY_ID');
    const walletId = Deno.env.get('MOBILE_MONEY_WALLET_ID');
    const merchantId = Deno.env.get('MOBILE_MONEY_MERCHANT_ID');
    const baseUrl = Deno.env.get('MOBILE_MONEY_BASE_URL') || 'http://localhost:8000';

    if (!apiKey || !keyId || !walletId || !merchantId) {
      console.error('Missing Mobile Money credentials', { hasApiKey: !!apiKey, hasKeyId: !!keyId, hasWalletId: !!walletId, hasMerchantId: !!merchantId });
      return new Response(
        JSON.stringify({ error: 'Payment service not configured', userMessage: 'Payment service not configured.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!amount || !reference || !payer) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields', userMessage: 'Please provide amount, reference, and payer phone number.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mobileMoneyPayload = {
      reference: String(reference),
      amount: String(amount),
      currency: String(currency),
      payer: String(payer),
      provider: String(provider),
    };

    const resp = await fetch(`${baseUrl}/api/v1/payments/mobile-money/${encodeURIComponent(walletId)}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(mobileMoneyPayload),
    });

    let data: any;
    try {
      data = await resp.json();
    } catch {
      const text = await resp.text();
      data = { message: text };
    }

    if (!resp.ok) {
      console.error('Mobile Money payment failed', resp.status, data);
      return new Response(
        JSON.stringify({ error: 'Payment initiation failed', details: data, userMessage: data?.message || 'Failed to initiate mobile money payment.' }),
        { status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const redirectUrl = data?.redirect_url || data?.redirectUrl || data?.checkout_url || data?.data?.redirect_url || data?.data?.checkout_url;

    return new Response(
      JSON.stringify({ success: true, redirectUrl, raw: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('mtn-momo-payment error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
