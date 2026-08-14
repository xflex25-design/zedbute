import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PESAPAL_BASE = 'https://pay.pesapal.com/v3/api';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      amount,
      currency = 'ZMW',
      reference,
      description,
      callback_url,
      redirect_url,
      customer = {},
    } = body;

    const consumerKey = Deno.env.get('PESAPAL_CONSUMER_KEY') || '4KELk9gVxyKMnj2rrzY9P8Z9Dyu8ysiY';
    const consumerSecret = Deno.env.get('PESAPAL_CONSUMER_SECRET') || 'DWUbYGRnyNM4h0jU3bXs5dk20qk=';

    if (!consumerKey || !consumerSecret) {
      console.error('Missing Pesapal credentials');
      return new Response(
        JSON.stringify({ error: 'Payment service not configured', userMessage: 'Payment service not configured.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Request Bearer token
    const tokenResp = await fetch(`${PESAPAL_BASE}/Auth/RequestToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consumer_key: consumerKey, consumer_secret: consumerSecret }),
    });

    if (!tokenResp.ok) {
      const tdata = await tokenResp.text();
      console.error('Pesapal token request failed', tokenResp.status, tdata);
      return new Response(JSON.stringify({ error: 'Auth failed' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const tokenJson = await tokenResp.json();
    const bearer = tokenJson?.token || tokenJson?.access_token || tokenJson?.data?.token;
    if (!bearer) {
      console.error('Pesapal token missing in response', tokenJson);
      return new Response(JSON.stringify({ error: 'Auth token missing' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const orderRef = reference || crypto.randomUUID();

    const orderPayload: any = {
      amount: Number(amount),
      currency,
      description: description || 'Payment',
      reference: orderRef,
      callback_url: callback_url || '',
      redirect_url: redirect_url || '',
      customer: {
        first_name: customer.first_name || customer.firstName || '',
        last_name: customer.last_name || customer.lastName || '',
        email: customer.email || '',
        phone_number: customer.phone || customer.phone_number || '',
      },
    };

    const submitResp = await fetch(`${PESAPAL_BASE}/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bearer}`,
      },
      body: JSON.stringify(orderPayload),
    });

    let submitJson: any;
    try {
      submitJson = await submitResp.json();
    } catch (e) {
      const text = await submitResp.text();
      console.warn('Failed to parse Pesapal submit response', text);
      submitJson = { message: text };
    }

    if (!submitResp.ok) {
      console.error('Pesapal submit failed', submitResp.status, submitJson);
      return new Response(JSON.stringify({ error: 'Payment creation failed', details: submitJson }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Try common redirect locations
    const redirect = submitJson?.redirect_url || submitJson?.data?.redirect_url || submitJson?.checkout_url || submitJson?.data?.checkout_url;

    return new Response(JSON.stringify({ success: true, redirectUrl: redirect, raw: submitJson }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('pesapal-create-order error', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
