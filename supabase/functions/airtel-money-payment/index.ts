import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LENCO_API_URL = 'https://api.lenco.co/access/v2';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { amount, phoneNumber, reference, payerMessage } = await req.json();

    const apiToken = Deno.env.get('LENCO_API_TOKEN');
    if (!apiToken) {
      console.error('Missing LENCO_API_TOKEN');
      return new Response(
        JSON.stringify({ error: 'Payment service not configured', userMessage: 'Payment service is not configured. Please contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number: ensure it starts with 260
    let formattedPhone = phoneNumber.replace(/\s+/g, '').replace(/^0/, '');
    if (!formattedPhone.startsWith('260')) {
      formattedPhone = '260' + formattedPhone;
    }

    console.log('Processing Airtel Money payment via Lenco for phone:', formattedPhone, 'Amount:', amount);

    const collectionBody = {
      amount: amount,
      country: "ZM",
      phone: formattedPhone,
      operator: "airtel",
      reference: reference || crypto.randomUUID(),
      description: payerMessage || "Payment for Mziki service",
    };

    console.log('Lenco collection request:', JSON.stringify(collectionBody));

    const response = await fetch(`${LENCO_API_URL}/collections/mobile-money`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(collectionBody),
    });

    const responseData = await response.json();
    console.log('Lenco response status:', response.status, 'data:', JSON.stringify(responseData));

    if (!response.ok) {
      const userMessage = mapLencoError(response.status, responseData);
      return new Response(
        JSON.stringify({
          error: responseData.message || 'Payment request failed',
          userMessage,
          details: responseData,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = responseData.data;

    if (!data) {
      return new Response(
        JSON.stringify({ error: 'Unexpected response from payment provider', userMessage: 'Payment provider returned an unexpected response. Please try again.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Lenco returns status: "pending" | "successful" | "failed" | "pay-offline"
    const status = data.status;

    if (status === 'successful') {
      return new Response(
        JSON.stringify({
          success: true,
          referenceId: data.reference || data.lencoReference,
          status: 'SUCCESSFUL',
          message: 'Payment completed successfully',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (status === 'failed') {
      return new Response(
        JSON.stringify({
          success: false,
          referenceId: data.reference || data.lencoReference,
          status: 'FAILED',
          error: data.reasonForFailure || 'Payment failed',
          userMessage: data.reasonForFailure || 'Payment was declined. Please try again.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For "pending" or "pay-offline" — poll for result
    if (status === 'pending' || status === 'pay-offline') {
      const collectionId = data.id;
      let finalStatus = status;
      let attempts = 0;
      const maxAttempts = 30;

      while ((finalStatus === 'pending' || finalStatus === 'pay-offline') && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const statusResponse = await fetch(`${LENCO_API_URL}/collections/${collectionId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
          },
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          finalStatus = statusData.data?.status || finalStatus;
          console.log('Lenco status check', attempts + 1, ':', finalStatus);

          if (finalStatus === 'successful') {
            return new Response(
              JSON.stringify({
                success: true,
                referenceId: statusData.data?.reference || statusData.data?.lencoReference || data.reference,
                status: 'SUCCESSFUL',
                message: 'Payment completed successfully',
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          if (finalStatus === 'failed') {
            return new Response(
              JSON.stringify({
                success: false,
                referenceId: statusData.data?.reference || data.reference,
                status: 'FAILED',
                error: statusData.data?.reasonForFailure || 'Payment failed',
                userMessage: statusData.data?.reasonForFailure || 'Payment was declined. Please try again.',
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        attempts++;
      }

      // Timeout — still pending
      return new Response(
        JSON.stringify({
          success: false,
          referenceId: data.reference || data.lencoReference,
          status: 'PENDING',
          message: 'Payment is still processing. Please check your phone to authorize the payment.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fallback
    return new Response(
      JSON.stringify({
        success: false,
        status: status,
        referenceId: data.reference || data.lencoReference,
        message: 'Unexpected payment status. Please try again.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error processing Airtel payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({
        error: errorMessage,
        userMessage: 'Failed to process payment. Please try again.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function mapLencoError(status: number, responseData: any): string {
  const msg = String(responseData?.message || '').toLowerCase();

  if (status === 401) return 'Payment service authentication failed. Please contact support.';
  if (status === 400 && (msg.includes('phone') || msg.includes('invalid'))) return 'The phone number looks invalid. Please check it and try again.';
  if (status === 400) return 'Payment request was rejected. Please check your details and try again.';
  if (msg.includes('insufficient')) return 'Insufficient funds. Please top up and try again.';
  if (status >= 500) return 'Payment service is temporarily unavailable. Please try again shortly.';

  return responseData?.message || 'Payment provider returned an error. Please try again.';
}
