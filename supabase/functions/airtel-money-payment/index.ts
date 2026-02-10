import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AIRTEL_BASE_URL = 'https://openapiuat.airtel.africa';

async function getAirtelToken(): Promise<string> {
  const clientId = Deno.env.get('AIRTEL_CLIENT_ID');
  const clientSecret = Deno.env.get('AIRTEL_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Airtel API credentials not configured');
  }

  const response = await fetch(`${AIRTEL_BASE_URL}/auth/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });

  const data = await response.json();
  console.log('Airtel token response status:', response.status);

  if (!response.ok || !data.access_token) {
    console.error('Token error:', JSON.stringify(data));
    throw new Error('Failed to authenticate with Airtel');
  }

  return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { amount, phoneNumber, reference, payerMessage } = await req.json();

    // Format phone: remove leading 0, ensure starts with 260
    let formattedPhone = phoneNumber.replace(/\s+/g, '').replace(/^0/, '');
    if (!formattedPhone.startsWith('260')) {
      formattedPhone = '260' + formattedPhone;
    }

    console.log('Processing Airtel payment for:', formattedPhone, 'Amount:', amount);

    const token = await getAirtelToken();
    const txnId = reference || crypto.randomUUID();

    const paymentBody = {
      reference: payerMessage || 'Payment for Mziki service',
      subscriber: {
        country: 'ZM',
        currency: 'ZMW',
        msisdn: formattedPhone,
      },
      transaction: {
        amount: amount,
        country: 'ZM',
        currency: 'ZMW',
        id: txnId,
      },
    };

    console.log('Airtel payment request:', JSON.stringify(paymentBody));

    const response = await fetch(`${AIRTEL_BASE_URL}/merchant/v2/payments/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Country': 'ZM',
        'X-Currency': 'ZMW',
      },
      body: JSON.stringify(paymentBody),
    });

    const responseData = await response.json();
    console.log('Airtel response:', response.status, JSON.stringify(responseData));

    if (!response.ok) {
      const userMessage = mapAirtelError(response.status, responseData);
      return new Response(
        JSON.stringify({ error: responseData.status?.message || 'Payment failed', userMessage }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const status = responseData.status?.code;
    const txnStatus = responseData.data?.transaction?.status;

    // Airtel returns status code "200" and transaction status
    if (txnStatus === 'TS') {
      return new Response(
        JSON.stringify({
          success: true,
          referenceId: responseData.data?.transaction?.id || txnId,
          status: 'SUCCESSFUL',
          message: 'Payment completed successfully',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (txnStatus === 'TF') {
      return new Response(
        JSON.stringify({
          success: false,
          referenceId: txnId,
          status: 'FAILED',
          error: responseData.status?.message || 'Payment failed',
          userMessage: responseData.status?.message || 'Payment was declined. Please try again.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transaction initiated (TIP) — poll for result
    if (txnStatus === 'TIP' || status === '200') {
      let attempts = 0;
      const maxAttempts = 30;

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const statusResponse = await fetch(
          `${AIRTEL_BASE_URL}/standard/v1/payments/${txnId}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'X-Country': 'ZM',
              'X-Currency': 'ZMW',
            },
          }
        );

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          const currentStatus = statusData.data?.transaction?.status;
          console.log('Status check', attempts + 1, ':', currentStatus);

          if (currentStatus === 'TS') {
            return new Response(
              JSON.stringify({
                success: true,
                referenceId: statusData.data?.transaction?.id || txnId,
                status: 'SUCCESSFUL',
                message: 'Payment completed successfully',
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          if (currentStatus === 'TF') {
            return new Response(
              JSON.stringify({
                success: false,
                referenceId: txnId,
                status: 'FAILED',
                error: statusData.status?.message || 'Payment failed',
                userMessage: statusData.status?.message || 'Payment was declined.',
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        attempts++;
      }

      // Timeout
      return new Response(
        JSON.stringify({
          success: false,
          referenceId: txnId,
          status: 'PENDING',
          message: 'Payment is still processing. Please check your phone to authorize.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fallback
    return new Response(
      JSON.stringify({
        success: false,
        status: txnStatus || status,
        referenceId: txnId,
        message: 'Unexpected payment status. Please try again.',
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

function mapAirtelError(status: number, data: any): string {
  const msg = String(data?.status?.message || '').toLowerCase();
  if (status === 401) return 'Payment service authentication failed. Please contact support.';
  if (msg.includes('insufficient')) return 'Insufficient funds. Please top up and try again.';
  if (msg.includes('invalid') && msg.includes('msisdn')) return 'Invalid phone number. Please check and try again.';
  if (status === 400) return 'Payment request was rejected. Please check your details.';
  if (status >= 500) return 'Airtel service is temporarily unavailable. Please try again shortly.';
  return data?.status?.message || 'Payment failed. Please try again.';
}
