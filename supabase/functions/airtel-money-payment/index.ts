import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};


serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { amount, phoneNumber, reference, payerMessage } = await req.json();

    const consumerKey = Deno.env.get('PESAPAL_CONSUMER_KEY') || '4KELk9gVxyKMnj2rrzY9P8Z9Dyu8ysiY';
    const consumerSecret = Deno.env.get('PESAPAL_CONSUMER_SECRET') || 'DWUbYGRnyNM4h0jU3bXs5dk20qk=';

    if (!consumerKey || !consumerSecret) {
      console.error('Missing Pesapal credentials');
      return new Response(JSON.stringify({ error: 'Payment service not configured', userMessage: 'Payment service not configured.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Format phone local
    let formattedPhone = phoneNumber.replace(/\s+/g, '');
    formattedPhone = formattedPhone.replace(/^\+?260/, '0');
    if (!formattedPhone.startsWith('0')) formattedPhone = '0' + formattedPhone;

    const ref = reference || crypto.randomUUID();

    // Request token
    const tokenResp = await fetch(`https://pay.pesapal.com/v3/api/Auth/RequestToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consumer_key: consumerKey, consumer_secret: consumerSecret }),
    });

    if (!tokenResp.ok) {
      const txt = await tokenResp.text();
      console.error('Pesapal auth failed', tokenResp.status, txt);
      return new Response(JSON.stringify({ error: 'Auth failed' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const tokenJson = await tokenResp.json();
    const bearer = tokenJson?.token || tokenJson?.access_token || tokenJson?.data?.token;
    if (!bearer) return new Response(JSON.stringify({ error: 'Auth token missing' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const orderPayload = {
      amount: Number(amount),
      currency: 'ZMW',
      description: payerMessage || 'Airtel Money Payment',
      reference: ref,
      customer: { phone_number: formattedPhone },
    };

    const submitResp = await fetch(`https://pay.pesapal.com/v3/api/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${bearer}` },
      body: JSON.stringify(orderPayload),
    });

    let submitJson: any;
    try { submitJson = await submitResp.json(); } catch (e) { submitJson = { message: await submitResp.text() }; }

    if (!submitResp.ok) {
      console.error('Pesapal submit failed', submitResp.status, submitJson);
      return new Response(JSON.stringify({ error: 'Payment creation failed', details: submitJson }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const redirect = submitJson?.redirect_url || submitJson?.data?.redirect_url || submitJson?.checkout_url || submitJson?.data?.checkout_url;

    return new Response(JSON.stringify({ success: true, redirectUrl: redirect, raw: submitJson }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('airtel-money-payment error', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

function mapPesapalError(status: number, data: any): string {
  const msg = String(data?.message || '').toLowerCase();
  if (status === 401) return 'Payment service authentication failed. Please contact support.';
  if (msg.includes('insufficient')) return 'Insufficient funds. Please top up and try again.';
  if (msg.includes('invalid') && msg.includes('phone')) return 'Invalid phone number. Please check and try again.';
  if (status === 400) return 'Payment request was rejected. Please check your details.';
  if (status === 429) return 'Too many payment attempts. Please wait a moment and try again.';
  if (status >= 500) return 'Payment service is temporarily unavailable. Please try again shortly.';
  return data?.message || 'Payment failed. Please try again.';
}
