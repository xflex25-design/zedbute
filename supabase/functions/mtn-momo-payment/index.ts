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
      payer,
      payer_email,
      payer_message,
      provider,
    } = body;

    const providerCodeMap: Record<string, string> = {
      airtel: 'AIRTEL_OAPI_ZMB',
      mtn: 'MTN_MOMO_ZMB',
      zamtel: 'ZAMTEL_ZMB',
    };

    const finalProvider = providerCodeMap[String(provider || '').toLowerCase()] || String(provider || 'MTN_MOMO_ZMB');

    const apiKey = Deno.env.get('MOBILE_MONEY_API_KEY');
    const keyId = Deno.env.get('MOBILE_MONEY_KEY_ID');
    const walletId = Deno.env.get('MOBILE_MONEY_WALLET_ID');
    const merchantId = Deno.env.get('MOBILE_MONEY_MERCHANT_ID');
    const baseUrl = Deno.env.get('MOBILE_MONEY_BASE_URL') || 'https://console.lipila.tech/api/v1';

    if (!apiKey || !keyId || !walletId || !merchantId) {
      console.error('Missing Mobile Money credentials', { hasApiKey: !!apiKey, hasKeyId: !!keyId, hasWalletId: !!walletId, hasMerchantId: !!merchantId });
      return new Response(
        JSON.stringify({ error: 'Payment service not configured', userMessage: 'Payment service not configured.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!amount || !payer) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields', userMessage: 'Please provide amount, payer phone number, and provider.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mobileMoneyPayload = {
      amount: String(amount),
      payer: String(payer),
      provider: finalProvider,
      payer_email: payer_email ? String(payer_email) : '',
      payer_message: payer_message ? String(payer_message) : '',
    };

    const resp = await fetch(`${baseUrl}/payments/mobile-money/${encodeURIComponent(walletId)}/`, {
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
