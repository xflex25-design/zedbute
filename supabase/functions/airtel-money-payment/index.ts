import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LENCO_BASE_URL = 'https://api.lenco.co/access/v2';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { amount, phoneNumber, reference, payerMessage } = await req.json();

    const lencoToken = Deno.env.get('LENCO_API_TOKEN');
    if (!lencoToken) {
      console.error('Missing LENCO_API_TOKEN');
      return new Response(
        JSON.stringify({ error: 'Payment service not configured', userMessage: 'Payment service is not configured. Please contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone: keep local format with leading zero for Lenco
    let formattedPhone = phoneNumber.replace(/\s+/g, '');
    // Remove country code if present, Lenco expects local format
    formattedPhone = formattedPhone.replace(/^\+?260/, '0');
    // Ensure starts with 0
    if (!formattedPhone.startsWith('0')) {
      formattedPhone = '0' + formattedPhone;
    }

    const ref = reference || crypto.randomUUID();
    console.log('Processing Airtel payment via Lenco for:', formattedPhone, 'Amount:', amount);

    const response = await fetch(`${LENCO_BASE_URL}/collections/mobile-money`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lencoToken}`,
        'Content-Type': 'application/json',
        'accept': 'application/json',
      },
      body: JSON.stringify({
        amount: Number(amount),
        phone: formattedPhone,
        operator: 'airtel',
        country: 'zm',
        reference: ref,
        narration: payerMessage || 'Payment for Mziki service',
      }),
    });

    const data = await response.json();
    console.log('Lenco response:', response.status, JSON.stringify(data));

    if (!response.ok || !data.status) {
      const userMessage = mapLencoError(response.status, data);
      return new Response(
        JSON.stringify({ error: data.message || 'Payment failed', userMessage }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const collectionId = data.data?.id;
    const collectionStatus = data.data?.status;

    if (collectionStatus === 'successful') {
      return new Response(
        JSON.stringify({
          success: true,
          referenceId: collectionId || ref,
          status: 'SUCCESSFUL',
          message: 'Payment completed successfully',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (collectionStatus === 'failed') {
      return new Response(
        JSON.stringify({
          success: false,
          referenceId: collectionId || ref,
          status: 'FAILED',
          error: data.data?.reasonForFailure || 'Payment failed',
          userMessage: data.data?.reasonForFailure || 'Payment was declined. Please try again.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Poll for result
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const statusResponse = await fetch(`${LENCO_BASE_URL}/collections/${collectionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${lencoToken}`,
        },
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        const currentStatus = statusData.data?.status;
        console.log('Status check', attempts + 1, ':', currentStatus);

        if (currentStatus === 'successful') {
          return new Response(
            JSON.stringify({
              success: true,
              referenceId: collectionId || ref,
              status: 'SUCCESSFUL',
              message: 'Payment completed successfully',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (currentStatus === 'failed') {
          return new Response(
            JSON.stringify({
              success: false,
              referenceId: collectionId || ref,
              status: 'FAILED',
              error: statusData.data?.reasonForFailure || 'Payment failed',
              userMessage: statusData.data?.reasonForFailure || 'Payment was declined.',
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      attempts++;
    }

    return new Response(
      JSON.stringify({
        success: false,
        referenceId: collectionId || ref,
        status: 'PENDING',
        message: 'Payment is still processing. Please check your phone to authorize.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Airtel payment error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: msg, userMessage: 'Failed to process payment. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function mapLencoError(status: number, data: any): string {
  const msg = String(data?.message || '').toLowerCase();
  if (status === 401) return 'Payment service authentication failed. Please contact support.';
  if (msg.includes('insufficient')) return 'Insufficient funds. Please top up and try again.';
  if (msg.includes('invalid') && msg.includes('phone')) return 'Invalid phone number. Please check and try again.';
  if (status === 400) return 'Payment request was rejected. Please check your details.';
  if (status === 429) return 'Too many payment attempts. Please wait a moment and try again.';
  if (status >= 500) return 'Payment service is temporarily unavailable. Please try again shortly.';
  return data?.message || 'Payment failed. Please try again.';
}
